#!/usr/bin/env python3
"""
AROHAN — IoT WhatsApp Alert Monitor (Standalone)

Monitors Firebase /ronin/iot for threshold breaches and sends
WhatsApp alerts via Twilio. Runs independently — no camera needed.

Usage:
    python whatsapp_monitor.py
"""

import os, time, json
from datetime import datetime
from typing import Dict, Optional

try:
    from dotenv import load_dotenv; load_dotenv()
except ImportError:
    pass

# ── Firebase ──────────────────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials, db as fb_db
    FIREBASE_OK = True
except ImportError:
    print("❌ firebase-admin not installed: pip install firebase-admin")
    FIREBASE_OK = False

# ── Twilio ────────────────────────────────────────────────────
try:
    from twilio.rest import Client as TwilioClient
    TWILIO_OK = True
except ImportError:
    print("❌ twilio not installed: pip install twilio")
    TWILIO_OK = False

# ══════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN  = os.getenv('TWILIO_AUTH_TOKEN',  '')
TWILIO_WA_FROM     = os.getenv('TWILIO_WA_FROM',     'whatsapp:+14155238886')
TWILIO_WA_TO       = os.getenv('TWILIO_WA_TO',       '')

FIREBASE_CRED_FILE = os.getenv('FIREBASE_CREDENTIALS', 'firebase-credentials.json')
FIREBASE_DB_URL    = os.getenv('FIREBASE_DB_URL', 'https://ronin-80b29-default-rtdb.firebaseio.com')
IOT_PATH           = 'ronin/iot'
POLL_INTERVAL      = 5   # seconds

# ══════════════════════════════════════════════════════════════
#  THRESHOLD RULES
# ══════════════════════════════════════════════════════════════
THRESHOLDS = {
    'flame': {
        'field': 'flame', 'op': 'bool_true', 'severity': 'critical',
        'type': 'Fire Detected',
        'msg': '🔥 Flame sensor triggered — immediate evacuation required!'
    },
    'mq2': {
        'field': 'mq2', 'op': '>', 'value': 700, 'severity': 'high',
        'type': 'Gas Leak',
        'msg': '⚠️ Dangerous gas levels detected'
    },
    'mq135': {
        'field': 'mq135', 'op': '>', 'value': 900, 'severity': 'medium',
        'type': 'Poor Air Quality',
        'msg': 'Air quality degraded'
    },
    'temperature': {
        'field': 'temperature', 'op': '>', 'value': 40, 'severity': 'medium',
        'type': 'High Temperature',
        'msg': '🌡️ Temperature exceeds safe limit'
    },
    'hazardScore': {
        'field': 'hazardScore', 'op': '>', 'value': 60, 'severity': 'high',
        'type': 'High Hazard Level',
        'msg': '☢️ Hazard score critical'
    },
    'motion': {
        'field': 'motion', 'op': 'bool_true', 'severity': 'low',
        'type': 'Motion Detected',
        'msg': '👤 Motion detected in monitored area'
    },
}

# ══════════════════════════════════════════════════════════════
#  WHATSAPP SENDER
# ══════════════════════════════════════════════════════════════
class WhatsAppSender:
    def __init__(self):
        self._client = None
        self._cooldowns: Dict[str, float] = {}
        self._cooldown_sec = 60  # 1 min between same alert type

        if TWILIO_OK:
            try:
                self._client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
                print(f"✅ Twilio ready → {TWILIO_WA_TO}")
            except Exception as e:
                print(f"❌ Twilio init failed: {e}")

    def send(self, alert_type: str, severity: str, summary: str,
             details: Optional[dict] = None) -> bool:
        if not self._client:
            print("⚠  Twilio not initialized — skipping")
            return False

        # Rate-limit
        now = time.time()
        if now - self._cooldowns.get(alert_type, 0) < self._cooldown_sec:
            print(f"⏳ Cooldown active for '{alert_type}' — skipped")
            return False

        emoji = {'low': '🟢', 'medium': '🟡', 'high': '🟠', 'critical': '🔴'}.get(severity, '⚪')

        msg  = f"🚨 *AROHAN ALERT — {alert_type}*\n"
        msg += "━━━━━━━━━━━━━━━━━\n"
        msg += f"Severity: {emoji} {severity.upper()}\n"

        if details:
            if details.get('location'):
                msg += f"📍 Location: {details['location']}\n"
            if details.get('temperature') is not None:
                msg += f"🌡️ Temp: {float(details['temperature']):.1f}°C\n"
            if details.get('humidity') is not None:
                msg += f"💧 Humidity: {float(details['humidity']):.1f}%\n"
            if details.get('mq2') is not None:
                msg += f"💨 Gas MQ-2: {details['mq2']} PPM\n"
            if details.get('mq135') is not None:
                msg += f"🌫️ Air MQ-135: {details['mq135']} PPM\n"
            if details.get('hazardScore') is not None:
                msg += f"☢️ Hazard: {float(details['hazardScore']):.1f}/100\n"

        ts = datetime.now().strftime('%d %b %Y, %I:%M %p')
        msg += f"⏰ Time: {ts}\n\n{summary}\n"
        msg += "━━━━━━━━━━━━━━━━━\n"
        msg += "_AROHAN Safety Monitoring System_"

        try:
            result = self._client.messages.create(
                body=msg, from_=TWILIO_WA_FROM, to=TWILIO_WA_TO
            )
            self._cooldowns[alert_type] = now
            print(f"✅ WhatsApp sent: {alert_type} → SID {result.sid}")

            # Log to Firebase
            try:
                fb_db.reference('ronin/whatsapp_logs').push({
                    'alertType': alert_type,
                    'severity': severity,
                    'recipient': TWILIO_WA_TO,
                    'messageSid': result.sid,
                    'status': result.status,
                    'timestamp': int(now * 1000),
                    'summary': summary
                })
            except Exception:
                pass
            return True

        except Exception as e:
            print(f"❌ WhatsApp failed ({alert_type}): {e}")
            try:
                fb_db.reference('ronin/whatsapp_logs').push({
                    'alertType': alert_type,
                    'severity': severity,
                    'status': 'failed',
                    'error': str(e),
                    'timestamp': int(now * 1000)
                })
            except Exception:
                pass
            return False


# ══════════════════════════════════════════════════════════════
#  IOT MONITOR
# ══════════════════════════════════════════════════════════════
class IoTMonitor:
    def __init__(self, sender: WhatsAppSender):
        self._wa = sender
        self._prev: Dict[str, any] = {}

    def check(self, data: dict):
        for key, rule in THRESHOLDS.items():
            field = rule['field']
            cur = data.get(field)
            if cur is None:
                continue

            prev = self._prev.get(field)
            triggered = False

            if rule['op'] == 'bool_true':
                triggered = bool(cur) and not bool(prev)
            elif rule['op'] == '>':
                try:
                    triggered = float(cur) > rule['value'] and (
                        prev is None or float(prev) <= rule['value']
                    )
                except (ValueError, TypeError):
                    pass

            if triggered:
                details = {
                    'location': 'IoT Station',
                    'mq2': data.get('mq2'),
                    'mq135': data.get('mq135'),
                    'temperature': data.get('temperature'),
                    'humidity': data.get('humidity'),
                    'hazardScore': data.get('hazardScore'),
                }
                summary = rule['msg']
                if rule['op'] == '>':
                    summary += f" ({field}: {cur})"
                self._wa.send(
                    alert_type=rule['type'],
                    severity=rule['severity'],
                    summary=summary,
                    details=details
                )

            self._prev[field] = cur


# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════
def main():
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  AROHAN — WhatsApp Alert Monitor")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    if not FIREBASE_OK or not TWILIO_OK:
        print("❌ Missing dependencies. Install with:")
        print("   pip install firebase-admin twilio")
        return

    # Init Firebase
    if not os.path.exists(FIREBASE_CRED_FILE):
        print(f"❌ Firebase credentials not found: {FIREBASE_CRED_FILE}")
        print("   Place your Firebase service account JSON in the backend folder")
        return

    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app(
                credentials.Certificate(FIREBASE_CRED_FILE),
                {'databaseURL': FIREBASE_DB_URL}
            )
        print(f"✅ Firebase connected → {IOT_PATH}")
    except Exception as e:
        print(f"❌ Firebase init failed: {e}")
        return

    # Init WhatsApp + Monitor
    sender = WhatsAppSender()
    monitor = IoTMonitor(sender)

    print(f"📡 Polling /{IOT_PATH} every {POLL_INTERVAL}s...")
    print(f"📱 Alerts → {TWILIO_WA_TO}")
    print("   Press Ctrl+C to stop\n")

    try:
        while True:
            try:
                data = fb_db.reference(IOT_PATH).get()
                if data and isinstance(data, dict):
                    monitor.check(data)
                else:
                    print("⚠  No IoT data at", IOT_PATH)
            except Exception as e:
                print(f"⚠  Poll error: {e}")
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        print("\n🛑 Monitor stopped.")


if __name__ == '__main__':
    main()
