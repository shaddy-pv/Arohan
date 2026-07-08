"""Usage:
  python iot_dispatch_server.py [--dry-run] [--rover-ip 192.168.4.1]

Requirements:
  pip install firebase-admin requests
"""

import firebase_admin
from firebase_admin import credentials, db
import requests
import threading
import queue
import time
import json
import argparse
import logging
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FIREBASE_DB_URL = "https://ronin-80b29-default-rtdb.firebaseio.com"
ROVER_AP_IP = "arohan.local"   # Defaulting to mDNS resolution on home network (fallback to "192.168.4.1" if disconnected)
ROVER_PORT = 80
POLL_ROVER_INTERVAL = 10       # seconds between rover status checks
COOLDOWN_AFTER_MISSION = 10   # seconds to wait after mission completes before accepting new calls
NODE_POLL_FALLBACK = 2        # seconds between polls if listener fails
LEGACY_IOT_PATH = "iotA"      # path name dispatched when ronin/iot/calling_status fires

# ─── Logging ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("dispatch_log.txt", mode="a", encoding="utf-8"),
    ],
)
log = logging.getLogger("dispatch")

# ─── Globals ─────────────────────────────────────────────────────────────────

dispatch_queue: queue.Queue = queue.Queue()
rover_busy = False
dry_run = False
offline_mode = False              # True = skip Firebase, use local HTTP trigger instead
rover_ip = ROVER_AP_IP
last_mission_end = 0.0
known_paths: set = set()          # path names available on Firebase
active_listeners: dict = {}       # node_name → listener handle
node_statuses: dict = {}          # node_name → last known calling_status

# ─── Firebase Helpers ────────────────────────────────────────────────────────

def init_firebase(cred_path: str) -> bool:
    """Initialize Firebase Admin SDK. Returns True on success, False on failure."""
    if not os.path.exists(cred_path):
        log.warning(f"⚠️  Firebase credential file not found: {cred_path}")
        log.info("  To generate: Firebase Console → Project Settings → Service Accounts → Generate new private key")
        log.info("  Running in OFFLINE mode — use local HTTP trigger on port 5555 instead.")
        return False
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DB_URL})
        log.info("✅ Firebase initialized")
        return True
    except Exception as e:
        log.error(f"Firebase init failed: {e}")
        log.info("  Running in OFFLINE mode — use local HTTP trigger on port 5555.")
        return False


def load_available_paths():
    """Fetch all saved path names from Firebase."""
    global known_paths
    try:
        ref = db.reference("ronin/rover/paths")
        paths_data = ref.get()
        if paths_data and isinstance(paths_data, dict):
            known_paths = set(paths_data.keys())
            log.info(f"Available paths: {known_paths}")
        else:
            known_paths = set()
            log.warning("No paths found in Firebase")
    except Exception as e:
        log.error(f"Failed to load paths: {e}")


def reset_calling_status(node_name: str):
    """Reset a node's calling_status to false in Firebase."""
    try:
        ref = db.reference(f"ronin/iot_nodes/{node_name}/status/calling_status")
        ref.set(False)
        log.info(f"Reset calling_status for {node_name}")
    except Exception as e:
        log.error(f"Failed to reset calling_status for {node_name}: {e}")


def update_rover_status_fb(status: str):
    """Update rover status in Firebase."""
    try:
        ref = db.reference("ronin/rover/status")
        ref.set(status)
    except Exception:
        pass  # Non-critical


# ─── Rover Communication ────────────────────────────────────────────────────

def rover_url(endpoint: str) -> str:
    return f"http://{rover_ip}:{ROVER_PORT}/{endpoint}"


def check_rover_alive() -> bool:
    """Check if rover is reachable."""
    try:
        r = requests.get(rover_url("rstatus"), timeout=3)
        return r.status_code == 200
    except requests.ConnectionError:
        return False
    except Exception:
        return False


def get_rover_status() -> dict | None:
    """Get rover status data from /rstatus endpoint."""
    try:
        r = requests.get(rover_url("rstatus"), timeout=3)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


# NOTE: poll_local_path_thread is defined below near the status_display_thread


def is_rover_idle() -> bool:
    """Check if rover is idle by querying it directly."""
    try:
        status = get_rover_status()
        if status:
            return status.get("state", "IDLE") == "IDLE" and not status.get("rep", False)
    except Exception:
        pass
    return True  # Assume idle if can't reach rover



def send_playpath(path_name: str) -> bool:
    """Fetch path from Firebase and POST it directly to rover."""
    # 1. Fetch path from Firebase
    try:
        ref = db.reference(f"ronin/rover/paths/{path_name}")
        path_data = ref.get()
        if not path_data:
            log.error(f"❌ Path '{path_name}' not found in Firebase database")
            return False
            
        # Ensure name is in the JSON payload
        if "name" not in path_data:
            path_data["name"] = path_name
            
        # IMPORTANT: Use compact separators so it matches ESP32's indexOf("\"steps\":[")
        payload = json.dumps(path_data, separators=(',', ':'))
        log.info(f"  Fetched path '{path_name}' from Firebase ({len(payload)} bytes)")
    except Exception as e:
        log.error(f"❌ Failed to fetch path from Firebase: {e}")
        return False

    # 2. Push path directly to rover
    try:
        log.info(f"  Pushing path to rover at {rover_url('pushpath')}...")
        r = requests.post(
            rover_url("pushpath"), 
            data=payload,
            headers={"Content-Type": "text/plain"}, # ESP32 WebServer handles plain text body easiest
            timeout=10
        )
        if r.status_code == 200:
            log.info(f"✅ Rover accepted pushed path '{path_name}': {r.text}")
            return True
        else:
            log.error(f"❌ Rover rejected pushed path '{path_name}': {r.status_code} {r.text}")
            return False
    except Exception as e:
        log.error(f"❌ Failed to push path to rover: {e}")
        return False


# ─── Dispatch Logic ──────────────────────────────────────────────────────────

def dispatch_worker():
    """
    Worker thread that processes the dispatch queue.
    Ensures only one mission runs at a time.
    """
    global rover_busy, last_mission_end

    log.info("Dispatch worker started")

    while True:
        # Block until a node name appears in the queue
        node_name = dispatch_queue.get()
        log.info(f"📋 Dequeued dispatch request: {node_name}")

        # ── Cooldown check ──
        elapsed = time.time() - last_mission_end
        if elapsed < COOLDOWN_AFTER_MISSION and last_mission_end > 0:
            wait = COOLDOWN_AFTER_MISSION - elapsed
            log.info(f"⏳ Cooldown: waiting {wait:.0f}s before next dispatch")
            time.sleep(wait)

        # ── Check path exists ──
        load_available_paths()  # Refresh
        if node_name not in known_paths:
            log.warning(f"⚠️ No path named '{node_name}' in Firebase. Skipping.")
            log.info(f"  Available paths: {known_paths}")
            log.info(f"  TIP: Record a path on the rover and save it with the name '{node_name}'")
            reset_calling_status(node_name)
            dispatch_queue.task_done()
            continue

        # ── Check rover is reachable ──
        if not check_rover_alive():
            log.error(f"🔌 Rover not reachable at {rover_ip}. Make sure you're connected to rover AP.")
            log.info("  Skipping this dispatch. Will retry on next call.")
            dispatch_queue.task_done()
            continue

        # ── Wait for rover to be idle ──
        retry = 0
        while not is_rover_idle() and retry < 60:
            log.info(f"⏳ Rover busy, waiting... ({retry+1}/60)")
            time.sleep(POLL_ROVER_INTERVAL)
            retry += 1

        if retry >= 60:
            log.error("Rover busy for too long. Skipping dispatch.")
            reset_calling_status(node_name)
            dispatch_queue.task_done()
            continue

        # ── Dispatch! ──
        rover_busy = True
        log.info(f"🚀 DISPATCHING rover to '{node_name}'")
        update_rover_status_fb("DISPATCHED")

        if dry_run:
            log.info(f"[DRY RUN] Would send: /playpath?name={node_name}")
            success = True
        else:
            success = send_playpath(node_name)

        if success:
            # Reset calling_status immediately
            reset_calling_status(node_name)

            # Monitor mission progress
            monitor_mission(node_name)
        else:
            log.error(f"Failed to dispatch to {node_name}")
            reset_calling_status(node_name)

        rover_busy = False
        last_mission_end = time.time()
        dispatch_queue.task_done()


def monitor_mission(node_name: str):
    """Poll rover directly via /rstatus until replay finishes, then trigger return."""
    log.info(f"📡 Monitoring FORWARD path for '{node_name}'...")
    start = time.time()
    timeout = 300  # 5 minutes max
    last_state = ""

    # Give rover a moment to start replaying
    time.sleep(3)

    # ── Wait for forward path to finish ──
    # The rover goes PATH → GASFOLLOW automatically inside the Arduino state machine.
    # It never goes IDLE after forward path — detect GASFOLLOW (or RETURN) as arrival.
    while time.time() - start < timeout:
        time.sleep(2)
        try:
            status = get_rover_status()
            if status is None:
                continue
            state = status.get("state", "IDLE")
            mission = status.get("mission", "")
            rep = status.get("rep", False)
            step = status.get("step", 0)
            total = status.get("total", 0)

            # Rover has left MI_PATH and entered ARRIVE
            if mission in ("ARRIVE", "GASFOLLOW", "RETURN", "DONE") or (state == "IDLE" and not rep):
                log.info(f"✅ Forward path to '{node_name}' COMPLETE! Rover arrived.")
                break
            elif f"{state} | {mission} | step={step}/{total}" != last_state:
                last_state = f"{state} | {mission} | step={step}/{total}"
                log.info(f"  📍 Forward: {last_state}")
        except Exception:
            pass
    else:
        log.warning(f"⏰ Forward path timed out after {timeout}s")
        update_rover_status_fb("IDLE")
        return

    # ── Server Initiates Gas Follow ──
    log.info(f"⚡ Server is triggering Gas Follow scan on the rover...")
    try:
        r = requests.get(rover_url("startgas"), timeout=3)
        if r.status_code == 200:
            log.info(f"✅ Rover accepted Gas Follow command.")
        else:
            log.warning(f"⚠️ Rover returned {r.status_code} when starting gas follow.")
    except Exception as e:
        log.warning(f"⚠️ Failed to trigger gas follow: {e}")

    # We just monitor the rover until it returns to IDLE.
    log.info(f"🔬 Rover is in Gas Follow Mode — monitoring until it returns to dock...")
    start = time.time()
    last_state = ""
    while time.time() - start < timeout:
        time.sleep(3)
        try:
            status = get_rover_status()
            if status is None:
                continue
            state = status.get("state", "IDLE")
            rep = status.get("rep", False)
            step = status.get("step", 0)
            total = status.get("total", 0)
            mission = status.get("mission", "")

            if state == "IDLE" and not rep:
                log.info(f"🏠 Rover returned to dock! Mission '{node_name}' fully complete!")
                update_rover_status_fb("IDLE")
                return

            label = f"{state} | {mission} | step={step}/{total}"
            if label != last_state:
                last_state = label
                log.info(f"  🤖 {label}")
        except Exception:
            pass

    log.warning(f"⏰ Mission timed out after {timeout}s")
    update_rover_status_fb("IDLE")


# ─── Firebase Listeners ─────────────────────────────────────────────────────

CONFIRM_DELAY = 10  # seconds — calling_status must stay True this long before dispatch
pending_confirms: dict = {}  # node_name → threading.Timer

def start_confirm_countdown(node_name: str):
    """Start a 10-second confirmation countdown for a node.
    If calling_status stays True for CONFIRM_DELAY seconds, dispatch the rover.
    If it goes False before that, cancel via cancel_confirm_countdown()."""
    if node_name in pending_confirms:
        log.info(f"⏳ '{node_name}' confirmation already counting down, ignoring duplicate")
        return
    log.info(f"🔔 NODE '{node_name}' calling_status → TRUE — starting {CONFIRM_DELAY}s confirmation countdown")

    def _confirmed(n=node_name):
        pending_confirms.pop(n, None)
        log.info(f"✅ '{n}' confirmed after {CONFIRM_DELAY}s — DISPATCHING rover!")
        if n not in [q for q in dispatch_queue.queue]:
            dispatch_queue.put(n)
            log.info(f"  Added '{n}' to dispatch queue (queue size: {dispatch_queue.qsize()})")
        else:
            log.info(f"  '{n}' already in dispatch queue, skipping duplicate")

    t = threading.Timer(CONFIRM_DELAY, _confirmed)
    t.daemon = True
    t.start()
    pending_confirms[node_name] = t

def cancel_confirm_countdown(node_name: str):
    """Cancel a pending confirmation countdown (false alarm)."""
    if node_name in pending_confirms:
        pending_confirms[node_name].cancel()
        pending_confirms.pop(node_name, None)
        log.info(f"❌ '{node_name}' calling_status → FALSE within {CONFIRM_DELAY}s — dispatch CANCELLED (false alarm)")

def on_node_status_change(event, node_name: str):
    """Called when a specific node's calling_status changes.
    
    False-alarm prevention: when calling_status goes True, we start a 10-second
    countdown.  If it drops back to False before the timer fires, the dispatch
    is cancelled (e.g. somebody smoking near the sensor).  Only if it stays
    True for the full CONFIRM_DELAY does the rover actually get queued.
    """
    value = event.data

    # Handle case where event.data is the full status object vs just the boolean
    if isinstance(value, dict):
        if "status" in value:
            value = value["status"].get("calling_status", False)
        else:
            value = value.get("calling_status", False)

    log.debug(f"Event for {node_name}: path={event.path}, data={event.data}")

    if value is True:
        start_confirm_countdown(node_name)
    else:
        cancel_confirm_countdown(node_name)
        if node_statuses.get(node_name) is True:
            pass  # already logged by cancel_confirm_countdown
    
    node_statuses[node_name] = value


def setup_node_listeners():
    """
    Discover all iot_nodes in Firebase and set up a listener for each one's calling_status.
    Also watches for new nodes being added.
    """
    log.info("Setting up IoT node listeners...")

    def on_nodes_change(event):
        """Top-level listener for the iot_nodes tree."""
        data = event.data
        path = event.path

        log.debug(f"Nodes tree event: path={path}, type={type(data)}")

        if path == "/" and isinstance(data, dict):
            # Initial load — set up listener for each node
            for node_name in data:
                if node_name not in active_listeners:
                    attach_node_listener(node_name)
                # Check if already calling
                node_data = data[node_name]
                if isinstance(node_data, dict):
                    status = node_data.get("status", {})
                    if isinstance(status, dict) and status.get("calling_status") is True:
                        log.info(f"🔔 Node '{node_name}' was already calling on startup!")
                        start_confirm_countdown(node_name)
        elif path == "/":
            # Could be a primitive or null — skip
            pass
        else:
            # A change within or addition of a node
            parts = path.strip("/").split("/")
            node_name = parts[0]
            if node_name not in active_listeners:
                attach_node_listener(node_name)
            
            # Cases to handle based on what changed
            if len(parts) == 1 and isinstance(data, dict):
                # The whole node changed
                status = data.get("status", {})
                if isinstance(status, dict):
                    if status.get("calling_status") is True:
                        start_confirm_countdown(node_name)
                    else:
                        cancel_confirm_countdown(node_name)
            elif len(parts) >= 2 and parts[1] == "status" and isinstance(data, dict):
                if data.get("calling_status") is True:
                    start_confirm_countdown(node_name)
                else:
                    cancel_confirm_countdown(node_name)
            elif len(parts) >= 3 and parts[1] == "status" and parts[2] == "calling_status":
                if data is True:
                    start_confirm_countdown(node_name)
                elif data is False:
                    cancel_confirm_countdown(node_name)

    # Listen to entire iot_nodes tree
    ref = db.reference("ronin/iot_nodes")
    ref.listen(on_nodes_change)
    log.info("Listening on ronin/iot_nodes/")


def attach_node_listener(node_name: str):
    """Attach a real-time listener to a specific node's calling_status."""
    log.info(f"  👂 Watching node: {node_name}")
    active_listeners[node_name] = True  # Track that we know about this node
    node_statuses[node_name] = False


# ─── Local HTTP Trigger Server (offline / no-internet mode) ─────────────────

class _LocalTriggerHandler(BaseHTTPRequestHandler):
    """
    Tiny HTTP server on port 5555 — allows triggering rover dispatch without Firebase.
    IoT nodes can POST to: http://<laptop-ip>:5555/trigger?node=<node_name>
    Or browse to: http://localhost:5555/trigger?node=<node_name>  (for manual testing)
    """
    def do_GET(self):
        self._handle()
    def do_POST(self):
        self._handle()
    def _handle(self):
        parsed = urlparse(self.path)
        if parsed.path == "/trigger":
            params = parse_qs(parsed.query)
            node = params.get("node", ["iot"])[0]
            log.info(f"🔔 [LOCAL TRIGGER] Node '{node}' triggered via HTTP")
            dispatch_queue.put(node)
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(f"OK — '{node}' queued for dispatch".encode())
        elif parsed.path == "/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            data = json.dumps({
                "rover_busy": rover_busy,
                "queue": dispatch_queue.qsize(),
                "offline": offline_mode
            })
            self.wfile.write(data.encode())
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *args):
        pass  # suppress default access log noise


def start_local_trigger_server(port: int = 5555):
    """Start the local HTTP trigger server in a background thread."""
    try:
        server = HTTPServer(("0.0.0.0", port), _LocalTriggerHandler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        log.info(f"🌐 Local trigger server started on port {port}")
        log.info(f"   IoT nodes without internet can POST to: http://<this-pc-ip>:{port}/trigger?node=<name>")
        log.info(f"   Manual test: http://localhost:{port}/trigger?node=iot")
    except Exception as e:
        log.warning(f"Could not start local trigger server: {e}")


# ─── Also watch old ronin/iot for backward compat ────────────────────────────

def setup_legacy_iot_listener():
    """Watch the existing ronin/iot/status/calling_status for backward compatibility."""
    log.info("Setting up legacy IoT listener (ronin/iot/status/calling_status)...")

    def on_legacy_change(event):
        value = event.data
        path = event.path

        if path == "/" and isinstance(value, dict):
            value = value.get("calling_status", False)
        elif path == "/calling_status":
            pass  # value is already the boolean
        else:
            return

        if value is True:
            log.info("🔔 Legacy IoT node (ronin/iot) is CALLING!")
            load_available_paths()
            target_path = LEGACY_IOT_PATH  # configured path name to dispatch
            if target_path in known_paths:
                log.info(f"✅ Dispatching legacy IoT → path '{target_path}'")
                dispatch_queue.put(target_path)
                # Reset legacy calling status
                try:
                    ref = db.reference("ronin/iot/status/calling_status")
                    ref.set(False)
                except Exception:
                    pass
            else:
                log.warning(f"⚠️ Legacy IoT called but path '{target_path}' not found in Firebase.")
                log.info(f"  Available paths: {known_paths}")
                log.info(f"  TIP: Save a path on the rover named '{target_path}'")

    ref = db.reference("ronin/iot/status")
    ref.listen(on_legacy_change)
    log.info("Listening on ronin/iot/status/")


# ─── Sensor Polling Thread ───────────────────────────────────────────────────────

SENSOR_POLL_INTERVAL = 5  # seconds between sensor reads

def poll_sensor_thread():
    """
    Periodically read the rover's /sens endpoint and push sensor
    readings (mq2, mq135, flame, hazard, risk, calling) to Firebase
    at ronin/rover/sensors.
    """
    log.info("Sensor polling thread started")
    while True:
        time.sleep(SENSOR_POLL_INTERVAL)
        if offline_mode:
            continue
        try:
            r = requests.get(rover_url("sensors"), timeout=3)
            if r.status_code != 200:
                continue
            data = r.json()

            temp_val   = data.get("temperature", -1.0)
            hum_val    = data.get("humidity", -1.0)
            mq2_val    = data.get("mq2", 0)
            mq135_val  = data.get("mq135", 0)
            hazard_val = data.get("hazard", 0)
            risk_val   = data.get("risk", "SAFE")

            sensor_data = {
                "temperature":     temp_val,
                "humidity":        hum_val,
                "mq2":             mq2_val,
                "mq135":           mq135_val,
                "hazardScore":     hazard_val,
                "riskLevel":       risk_val,
                "mq2_raw_12bit":   mq2_val,
                "mq135_raw_12bit": mq135_val,
            }

            # Use .update() to merge — .set() wipes emergency, status, humidity etc.
            db.reference("ronin/rover/sensors").update(sensor_data)
            # Also update the heartbeat so dashboard knows rover is live
            db.reference("ronin/rover/sensors/status").update({
                "lastHeartbeat": int(time.time() * 1000),
                "online": True,
            })

            # log.info(f"📡 Sensor push → mq2={mq2_val}  mq135={mq135_val}  "
            #          f"temp={temp_val:.1f}  hum={hum_val:.1f}  "
            #          f"hazard={hazard_val}  risk={risk_val}")

        except requests.ConnectionError:
            log.info("Sensor poll: rover unreachable")
        except Exception as e:
            log.error(f"Sensor poll error: {e}")



# ─── Status Display ─────────────────────────────────────────────────────────

def poll_local_path_thread():
    """
    Periodically poll the rover to see if it recorded a new path and
    upload it to Firebase if it does not already exist there.

    BUG FIX: We no longer rely on the local `known_paths` cache to decide
    whether to upload. That cache can be stale (e.g. path existed in a
    previous session, got deleted from Firebase, but `known_paths` still
    thinks it's there → upload is silently skipped forever).
    Instead we do a direct Firebase read to confirm the path is really there.
    """
    # Track the last rover-side (name, step-count) pair we successfully uploaded
    # so we don't spam Firebase with identical writes every 5 s.
    last_uploaded_name  = None
    last_uploaded_count = 0

    while True:
        time.sleep(5)
        # Skip while rover is replaying a path to avoid interfering
        if rover_busy:
            continue

        try:
            r = requests.get(rover_url("getlocalpath"), timeout=2)
            if r.status_code != 200:
                continue

            data          = r.json()
            path_name     = data.get("name", "")
            step_count    = data.get("count", 0)
            pending_delete= data.get("pendingDelete", "")

            # ── Handle DELETE requests from the rover dashboard ──────────────
            # When the user taps ✕ on the dashboard, the rover sets pendingDelete
            # and clears its own RAM/Flash. We must also remove it from Firebase
            # and reset the upload cache so the name can be reused fresh.
            if pending_delete:
                log.info(f"🗑️  Dashboard requested deletion of path '{pending_delete}'")
                try:
                    db.reference(f"ronin/rover/paths/{pending_delete}").delete()
                    known_paths.discard(pending_delete)
                    if last_uploaded_name == pending_delete:
                        last_uploaded_name  = None
                        last_uploaded_count = 0
                    log.info(f"✅ Deleted '{pending_delete}' from Firebase and local cache")
                except Exception as e:
                    log.error(f"❌ Failed to delete from Firebase: {e}")
                # Tell rover the Firebase delete is done — clears the pending flag
                try:
                    requests.get(rover_url("cleardeleteflag"), timeout=2)
                except Exception:
                    pass
                continue  # Don't upload anything this cycle

            # Ignore empty / transient "pushed" placeholder paths
            if not path_name or path_name == "pushed" or step_count == 0:
                continue

            # --- Fast skip: same name AND same step-count as what we just uploaded ---
            if path_name == last_uploaded_name and step_count == last_uploaded_count:
                continue

            # --- Authoritative check: does this path actually exist in Firebase? ---
            try:
                existing = db.reference(f"ronin/rover/paths/{path_name}").get()
                already_in_firebase = existing is not None
            except Exception:
                # If we can't reach Firebase assume it's not there (safe to retry)
                already_in_firebase = False

            if already_in_firebase:
                # Path is genuinely in Firebase — keep local cache in sync and move on
                known_paths.add(path_name)
                last_uploaded_name  = path_name
                last_uploaded_count = step_count
                continue

            # --- New / missing path — upload it ---
            log.info(f"💾 Rover has local path '{path_name}' ({step_count} steps) "
                     f"that is NOT in Firebase — uploading...")
            try:
                ref = db.reference(f"ronin/rover/paths/{path_name}")
                ref.set(data)
                log.info(f"☁️  Successfully uploaded path '{path_name}' to Firebase!")
                known_paths.add(path_name)
                last_uploaded_name  = path_name
                last_uploaded_count = step_count
            except Exception as e:
                log.error(f"❌ Failed to upload local path to Firebase: {e}")

        except Exception:
            pass  # Rover unreachable — silently retry next cycle

def status_display_thread():
    """Periodically print status summary."""
    while True:
        time.sleep(30)
        log.info("─" * 50)
        log.info(f"STATUS | Queue: {dispatch_queue.qsize()} | Rover busy: {rover_busy}")
        log.info(f"  Nodes tracked: {list(active_listeners.keys())}")
        log.info(f"  Known paths: {known_paths}")
        
        # Check rover connectivity only if it's idle to avoid interrupting its movement
        if not rover_busy:
            alive = check_rover_alive()
            log.info(f"  Rover reachable: {'✅' if alive else '❌'} ({rover_ip})")
        else:
            log.info(f"  Rover busy, skipping ping to prevent jerks ({rover_ip})")
        log.info("─" * 50)


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    global dry_run, rover_ip, offline_mode

    parser = argparse.ArgumentParser(description="AROHAN Rover IoT Dispatch Server")
    parser.add_argument("--dry-run", action="store_true",
                        help="Don't actually send commands to rover")
    parser.add_argument("--offline", action="store_true",
                        help="Skip Firebase — use local HTTP trigger on port 5555 (for hackathon with no internet)")
    parser.add_argument("--rover-ip", default=ROVER_AP_IP,
                        help=f"Rover IP address (default: {ROVER_AP_IP})")
    parser.add_argument("--cred", default="firebase-service-account.json",
                        help="Path to Firebase service account JSON")
    args = parser.parse_args()

    dry_run = args.dry_run
    rover_ip = args.rover_ip

    log.info("=" * 60)
    log.info("  AROHAN ROVER — IoT Multi-Node Dispatch Server")
    log.info("=" * 60)
    log.info(f"  Rover IP:   {rover_ip}")
    log.info(f"  Dry run:    {dry_run}")
    log.info(f"  Offline:    {args.offline}")
    log.info(f"  Cred file:  {args.cred}")
    log.info("")

    # ── Always start local trigger server (useful even in online mode) ──
    start_local_trigger_server(5555)

    # ── Firebase setup (skipped in --offline mode) ──
    if args.offline:
        offline_mode = True
        log.info("🔴 OFFLINE MODE — Firebase disabled.")
        log.info("   Connect PC WiFi to rover AP (192.168.4.1)")
        log.info("   Trigger dispatch via: http://localhost:5555/trigger?node=<name>")
        log.info("   Or have IoT nodes POST to: http://<this-pc-ip>:5555/trigger?node=<name>")
    else:
        fb_ok = init_firebase(args.cred)
        if fb_ok:
            load_available_paths()
            # Start local path polling thread (uploads new rover paths to Firebase)
            lp_thread = threading.Thread(target=poll_local_path_thread, daemon=True)
            lp_thread.start()
            # Start sensor polling thread (pushes mq2/mq135/flame/hazard to Firebase)
            sens_thread = threading.Thread(target=poll_sensor_thread, daemon=True)
            sens_thread.start()
        else:
            offline_mode = True
            log.warning("⚠️  Firebase unavailable — falling back to offline mode.")

    # ── Start dispatch worker thread ──
    worker = threading.Thread(target=dispatch_worker, daemon=True)
    worker.start()

    # ── Start status display thread ──
    st_thread = threading.Thread(target=status_display_thread, daemon=True)
    st_thread.start()

    # ── Set up Firebase listeners (only in online mode) ──
    if not offline_mode:
        setup_node_listeners()       # New multi-node: ronin/iot_nodes/
        setup_legacy_iot_listener()  # Backward compat: ronin/iot/

    log.info("")
    if offline_mode:
        log.info("🟡 Dispatch server running (OFFLINE). Press Ctrl+C to stop.")
        log.info("   Trigger via: http://localhost:5555/trigger?node=<path_name>")
    else:
        log.info("🟢 Dispatch server running (ONLINE). Press Ctrl+C to stop.")
        log.info("   Waiting for IoT nodes to call via Firebase...")
    log.info("")

    # ── Keep main thread alive ──
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("\n🔴 Shutting down dispatch server.")
        sys.exit(0)


if __name__ == "__main__":
    main()
