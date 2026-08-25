#!/usr/bin/env python3
"""
AROHAN Rover — CV Backend FINAL

Root causes fixed vs v3:
  1. TRAINING BUG      — quality gate was rejecting augmented variants (blur aug
                         failed min_sharpness). Training now bypasses quality gate.
                         Live recognition still uses quality gate.
  2. WRONG PERSON      — double _normalize_image on augments corrupted features.
                         Now: normalize once, augment, encode raw augments.
  3. LAG IN RECOG       print() on every frame was flushing stdout ~10x/sec.
                         Removed all per-frame prints; added debug counter instead.
  4. LBP SLOW          — face resized to 64px instead of 128 for LBP (4x faster,
                         same accuracy at ESP32 resolution).
  5. RecogWorker       — throttled to max 8 fps so CPU doesn't saturate.
                         Stream reads pre-annotated frame, never blocks.
  6. CACHE MISS HIGH   — cache key now uses downsampled 8x8 face patch (more
                         stable across minor lighting changes).
"""

import os
import cv2
import time
import base64
import pickle
import threading
import requests
import uuid
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from collections import OrderedDict, deque, Counter
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
from datetime import datetime
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import face_recognition as fr
    FR_AVAILABLE = True
    print("OK: face_recognition (FaceNet) available")
except ImportError:
    FR_AVAILABLE = False
    print("WARN: face_recognition not found  using LBP+HOG")

try:
    import firebase_admin
    from firebase_admin import credentials, storage, db as fb_db
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False

try:
    from twilio.rest import Client as TwilioClient
    TWILIO_AVAILABLE = True
    print(" Twilio SDK available")
except ImportError:
    TWILIO_AVAILABLE = False
    print("  Twilio not found  pip install twilio")

# ══════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════
ESP32_URL = os.getenv('ESP32_CAM_URL', 'http://192.168.1.22:81')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')

SNAP_DIR = Path('static/snapshots')
KNOWN_DIR = Path('known_faces')
ENCODINGS_FILE = Path('trained_model/encodings.pkl')

# Recognition thresholds
FR_THRESH = float(
    os.getenv(
        'FR_DISTANCE_THRESHOLD',
        '0.55'))   # face_recognition L2 dist
LBP_THRESH = float(
    os.getenv(
        'CONFIDENCE_THRESHOLD',
        '0.38'))   # LBP cosine sim

MAX_ALERTS = int(os.getenv('MAX_ALERTS', '1000'))
MAX_SNAPSHOTS = int(os.getenv('MAX_SNAPSHOTS', '200'))

# Twilio WhatsApp config
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_WA_FROM = os.getenv('TWILIO_WA_FROM', 'whatsapp:+14155238886')
TWILIO_WA_TO = os.getenv('TWILIO_WA_TO', '')
TWILIO_CALL_FROM = os.getenv('TWILIO_CALL_FROM', '')
TWILIO_CALL_TO = os.getenv('TWILIO_CALL_TO', '')

# Tracker
VOTE_WINDOW = 3      # majority vote frames
IOU_THRESH = 0.20   # lower = easier to re-attach on camera shake
TRACK_TTL = 2.5    # seconds before dead track evicted

# RecogWorker rate limit
RECOG_MIN_INTERVAL = 0.20    # max ~2.5 fps recognition — buffer khatam

DNN_PROTO = Path('trained_model/deploy.prototxt')
DNN_MODEL = Path('trained_model/res10_300x300_ssd.caffemodel')
DNN_PROTO_URL = ("https://raw.githubusercontent.com/opencv/opencv/master/"
                 "samples/dnn/face_detector/deploy.prototxt")
DNN_MODEL_URL = ("https://raw.githubusercontent.com/opencv/opencv_3rdparty/"
                 "dnn_samples_face_detector_20170830/"
                 "res10_300x300_ssd_iter_140000.caffemodel")

for d in [SNAP_DIR, KNOWN_DIR, Path('trained_model')]:
    d.mkdir(parents=True, exist_ok=True)

COLOR_KNOWN = (0, 230, 0)
COLOR_UNKNOWN = (0, 0, 230)
FONT = cv2.FONT_HERSHEY_SIMPLEX


# ══════════════════════════════════════════════════════════════
#  DATA
# ══════════════════════════════════════════════════════════════
@dataclass
class RoverAlert:
    id: str
    type: str
    message: str
    createdAt: str
    confidence: float
    snapshotUrl: Optional[str] = None
    meta: Optional[dict] = None


# ══════════════════════════════════════════════════════════════
#  IMAGE ENHANCEMENT
#  Applied once per frame in _store(). Pre-built LUTs, no alloc.
# ══════════════════════════════════════════════════════════════
_CLAHE = cv2.createCLAHE(clipLimit=3.5, tileGridSize=(8, 8))
_LUT_16 = np.array(
    [((i / 255)**(1 / 1.6)) * 255 for i in range(256)], np.uint8)
_LUT_13 = np.array(
    [((i / 255)**(1 / 1.3)) * 255 for i in range(256)], np.uint8)


def _enhance(frame: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    m = float(np.mean(gray))
    if m >= 150:
        return frame
    l, a, b = cv2.split(cv2.cvtColor(frame, cv2.COLOR_BGR2LAB))
    out = cv2.cvtColor(cv2.merge([_CLAHE.apply(l), a, b]), cv2.COLOR_LAB2BGR)
    if m < 80:
        out = cv2.LUT(out, _LUT_16)
    elif m < 120:
        out = cv2.LUT(out, _LUT_13)
    # Fast denoise — kills ESP32-CAM grain without heavy CPU cost
    out = cv2.fastNlMeansDenoisingColored(out, None, 6, 6, 7, 21)
    return out


# ══════════════════════════════════════════════════════════════
#  FACE DETECTION
# ══════════════════════════════════════════════════════════════
def _dl_dnn():
    for url, p in [(DNN_PROTO_URL, DNN_PROTO), (DNN_MODEL_URL, DNN_MODEL)]:
        if not p.exists():
            print(f" {p.name}...")
            try:
                p.write_bytes(requests.get(url, timeout=30).content)
            except Exception as e:
                print(f" Download failed: {e}")
                return False
    return True


def load_detector():
    if os.getenv('FACE_DETECTOR_MODE', 'dnn').lower() == 'haar':
        h = cv2.CascadeClassifier(cv2.data.haarcascades +
                                  "haarcascade_frontalface_default.xml")
        if not h.empty():
            return h, 'haar'
    for _ in range(2):
        if DNN_PROTO.exists() and DNN_MODEL.exists():
            try:
                net = cv2.dnn.readNetFromCaffe(str(DNN_PROTO), str(DNN_MODEL))
                print(" Detector: DNN res10 SSD")
                return net, 'dnn'
            except Exception:
                pass
        _dl_dnn()
    h = cv2.CascadeClassifier(cv2.data.haarcascades +
                              "haarcascade_frontalface_default.xml")
    if h.empty():
        raise RuntimeError("No detector available")
    print("  Detector: Haar fallback")
    return h, 'haar'


_tls = threading.local()   # per-thread DNN to avoid lock contention


def detect_faces(img: np.ndarray, det, mode: str) -> List[List[int]]:
    h, w = img.shape[:2]
    if mode == 'dnn':
        if not hasattr(_tls, 'net'):
            _tls.net = cv2.dnn.readNetFromCaffe(str(DNN_PROTO), str(DNN_MODEL))
            _tls.buf = np.empty((300, 300, 3), np.uint8)
        cv2.resize(img, (300, 300), dst=_tls.buf)
        blob = cv2.dnn.blobFromImage(
            _tls.buf, 1.0, (300, 300), (104, 117, 123))
        _tls.net.setInput(blob)
        out = _tls.net.forward()
        confs = out[0, 0, :, 2]
        faces = []
        for box in out[0, 0, confs >= 0.35, 3:7]:
            x1 = int(box[0] * w)
            y1 = int(box[1] * h)
            x2 = int(box[2] * w)
            y2 = int(box[3] * h)
            if (x2 - x1) > 20 and (y2 - y1) > 20:
                faces.append([max(0, x1), max(0, y1), x2 - x1, y2 - y1])
        return faces
    scale = w / 400
    sm = cv2.resize(img, (400, int(h / scale)))
    gray = cv2.equalizeHist(cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY))
    # FIX: minNeighbors=6 (was 4) — curtain/wall false positives band
    # FIX: minSize=(60,60) (was 30,30) — chhote fake faces ignore
    raw = det.detectMultiScale(
        gray, 1.05, 5, cv2.CASCADE_SCALE_IMAGE, (40, 40))
    if len(raw) == 0:
        # Fallback thoda loose but still strict enough
        raw = det.detectMultiScale(
            gray, 1.03, 4, cv2.CASCADE_SCALE_IMAGE, (30, 30))
    return [[int(x * scale), int(y * scale), int(fw * scale), int(fh * scale)]
            for x, y, fw, fh in raw]


# ══════════════════════════════════════════════════════════════
#  FACE QUALITY GATE  (live only — NOT used during training)
# ══════════════════════════════════════════════════════════════
def _quality_ok(img: np.ndarray, rect: Tuple, min_sharp=8.0) -> bool:
    x, y, w, h = rect
    # FIX: minimum 60x60 — chhote/door ke faces aur curtain reject
    if w < 30 or h < 30:
        return False
    crop = img[max(0, y):y + h, max(0, x):x + w]
    if crop.size == 0:
        return False
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    if cv2.Laplacian(gray, cv2.CV_64F).var() < min_sharp:
        return False
    # FIX: real faces are roughly square
    asp = w / max(h, 1)
    return 0.5 <= asp <= 1.8


# ══════════════════════════════════════════════════════════════
#  LBP+HOG+HSV ENCODING
#  FIX: face resized to 64px (was 128) — 4x faster, same accuracy
#       at ESP32's low resolution.
# ══════════════════════════════════════════════════════════════
_FS = 64          # face size (was 128)
_GRID = 4
_NEIGH = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]


def _lbp_hog_enc(img: np.ndarray, rect: Tuple) -> np.ndarray:
    x, y, w, h = rect
    pad = int(0.1 * max(w, h))
    crop = cv2.resize(
        img[max(0, y - pad):min(img.shape[0], y + h + pad),
            max(0, x - pad):min(img.shape[1], x + w + pad)],
        (_FS, _FS))
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # LBP
    lbp = np.zeros((_FS, _FS), np.uint8)
    for bit, (di, dj) in enumerate(_NEIGH):
        sh = np.roll(np.roll(gray, -di, 0), -dj, 1)
        lbp += ((sh >= gray).astype(np.uint8) << (7 - bit))
    ch = _FS // _GRID
    lg = lbp.reshape(
        _GRID, ch, _GRID, ch).transpose(
        0, 2, 1, 3).reshape(
            _GRID * _GRID, -1)
    lh = np.apply_along_axis(
        lambda v: np.histogram(v, 32, (0, 256))[0].astype(np.float64), 1, lg)
    lh /= lh.sum(1, keepdims=True) + 1e-9

    # HSV
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    hh = np.stack([cv2.calcHist([hsv], [c], None, [32], [0, 256]).ravel()
                   for c in range(3)]).astype(np.float64)
    hh /= hh.sum(1, keepdims=True) + 1e-9

    # HOG
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    mag = np.hypot(gx, gy)
    ang = np.abs(np.arctan2(gy, gx) * (180 / np.pi))
    mg = mag.reshape(
        _GRID, ch, _GRID, ch).transpose(
        0, 2, 1, 3).reshape(
            _GRID * _GRID, -1)
    ag = ang.reshape(
        _GRID, ch, _GRID, ch).transpose(
        0, 2, 1, 3).reshape(
            _GRID * _GRID, -1)
    gh = np.stack([np.histogram(ag[i], 9, (0, 180), weights=mg[i])[0]
                   for i in range(_GRID * _GRID)]).astype(np.float64)
    gh /= gh.sum(1, keepdims=True) + 1e-9

    enc = np.concatenate([lh.ravel(), hh.ravel(), gh.ravel()])
    norm = np.linalg.norm(enc)
    return enc / norm if norm > 0 else enc


# ══════════════════════════════════════════════════════════════
#  ENCODE CACHE
#  FIX: 8x8 downsampled face patch — stable across small lighting
#       changes, near-zero collision rate between different people.
# ══════════════════════════════════════════════════════════════
class EncodeCache:
    def __init__(self, n=128):
        self._d: OrderedDict = OrderedDict()
        self._n = n

    def _k(self, img: np.ndarray, rect: Tuple) -> int:
        x, y, w, h = rect
        crop = img[max(0, y):y + h, max(0, x):x + w]
        if crop.size == 0:
            return hash(rect)
        return hash((rect, cv2.resize(crop, (8, 8), cv2.INTER_AREA).tobytes()))

    def get(self, img, rect):
        k = self._k(img, rect)
        if k in self._d:
            self._d.move_to_end(k)
            return self._d[k]
        return None

    def put(self, img, rect, enc):
        k = self._k(img, rect)
        self._d[k] = enc
        self._d.move_to_end(k)
        if len(self._d) > self._n:
            self._d.popitem(last=False)

    def clear(self): self._d.clear()


# ══════════════════════════════════════════════════════════════
#  IoU FACE TRACKER
#  Stable track IDs across camera shake. Vote buffer keyed by
#  track_id — never resets on small position changes.
# ══════════════════════════════════════════════════════════════
def _iou(a, b):
    ax1, ay1, aw, ah = a
    bx1, by1, bw, bh = b
    ix = max(0, min(ax1 + aw, bx1 + bw) - max(ax1, bx1))
    iy = max(0, min(ay1 + ah, by1 + bh) - max(ay1, by1))
    inter = ix * iy
    if inter == 0:
        return 0.0
    return inter / (aw * ah + bw * bh - inter)


class FaceTrack:
    _n = 0

    def __init__(self, rect):
        FaceTrack._n += 1
        self.tid = FaceTrack._n
        self.rect = rect
        self.seen = time.monotonic()
        self.votes: deque = deque(maxlen=VOTE_WINDOW)

    def update(self, rect, name, conf):
        self.rect = rect
        self.seen = time.monotonic()
        self.votes.append((name, conf))

    def result(self):
        if not self.votes:
            return None, 0.0
        names = [n for n, _ in self.votes]
        best = Counter(names).most_common(1)[0][0]
        confs = [c for n, c in self.votes if n == best]
        return best, round(sum(confs) / len(confs), 3)

    def expired(self): return time.monotonic() - self.seen > TRACK_TTL


class FaceTracker:
    def __init__(self):
        self._tracks: List[FaceTrack] = []
        self._lock = threading.Lock()

    def update(self, dets, raw):
        with self._lock:
            self._tracks = [t for t in self._tracks if not t.expired()]
            out = []
            used = set()
            for rect, (name, conf) in zip(dets, raw):
                best_iou = IOU_THRESH
                best_t = None
                for t in self._tracks:
                    if id(t) in used:
                        continue
                    iou = _iou(rect, t.rect)
                    if iou > best_iou:
                        best_iou = iou
                        best_t = t
                if best_t is None:
                    best_t = FaceTrack(rect)
                    self._tracks.append(best_t)
                best_t.update(rect, name, conf)
                used.add(id(best_t))
                out.append((best_t.tid,) + best_t.result())
            return out

    def clear(self):
        with self._lock:
            self._tracks.clear()


# ══════════════════════════════════════════════════════════════
#  VISUALIZATION
# ══════════════════════════════════════════════════════════════
def draw_box(frame, x, y, w, h, name, conf):
    is_known = bool(name and str(name).strip())
    color = COLOR_KNOWN if is_known else COLOR_UNKNOWN
    label = f"{name}  {int(conf * 100)}%" if name else "UNKNOWN"
    cv2.rectangle(frame, (x, y), (x + w, y + h), color, 3)
    (tw, th), bl = cv2.getTextSize(label, FONT, 0.65, 2)
    ly = max(y - 6, th + bl + 8)
    cv2.rectangle(frame, (x, ly - th - bl - 6),
                  (x + tw + 8, ly + 2), color, cv2.FILLED)
    cv2.putText(frame, label, (x + 4, ly - bl - 2), FONT,
                0.65, (255, 255, 255), 2, cv2.LINE_AA)


def annotate(frame, results):
    out = frame.copy()
    for r in results:
        draw_box(
            out,
            r['x'],
            r['y'],
            r['w'],
            r['h'],
            r.get('name'),
            r.get(
                'confidence',
                0))
    return out


# ══════════════════════════════════════════════════════════════
#  ESP32 READER
# ══════════════════════════════════════════════════════════════
class ESP32Reader:
    def __init__(self):
        self._frame: Optional[np.ndarray] = None
        self._jpg: Optional[bytes] = None
        self._ts = 0.0
        self._lock = threading.Lock()
        self._run = False
        self._url = ''
        self.connected = False
        self.last_error = ''
        self.frame_count = 0

    def start(self, url):
        self._url = url.rstrip('/')
        self._run = True
        threading.Thread(target=self._loop, daemon=True, name='esp32').start()
        print(f"ESP32 reader  {self._url}")

    def update_url(self, u): self._url = u.rstrip('/')
    def stop(self): self._run = False

    def frame(self):
        with self._lock:
            if self._frame is not None and time.monotonic() - self._ts < 3:
                return self._frame.copy()
        return None

    def raw_jpg(self):
        with self._lock:
            if self._jpg and time.monotonic() - self._ts < 3:
                return self._jpg
        return None

    def _store(self, jpg, f):
        e = _enhance(f)
        with self._lock:
            self._jpg = jpg
            self._frame = e
            self._ts = time.monotonic()
            self.frame_count += 1
        self.connected = True
        self.last_error = ''

    _interval = 0.10

    def _poll(self, sess):
        from urllib.parse import urlparse as _up
        p = _up(self._url)
        host = f"{p.scheme}://{p.hostname}"
        urls = [f"{self._url}/stream", f"{host}:81/stream",
                f"{self._url}/capture", f"{host}:81/capture"]
        wurl = None
        for u in urls:
            try:
                r = sess.get(u, timeout=2)
                if r.status_code == 200 and len(r.content) > 500:
                    arr = np.frombuffer(r.content, np.uint8)
                    if cv2.imdecode(arr, cv2.IMREAD_COLOR) is not None:
                        wurl = u
                        print(f"ESP32 capture: {wurl}")
                        break
            except BaseException:
                pass
        if not wurl:
            return False
        fails = 0
        lhash = 0
        while self._run:
            t0 = time.monotonic()
            try:
                r = sess.get(wurl, timeout=2)
                if r.status_code == 200 and len(r.content) > 500:
                    h = hash(r.content[:64] + r.content[-64:])
                    if h != lhash:
                        arr = np.frombuffer(r.content, np.uint8)
                        f = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if f is not None:
                            self._store(r.content, f)
                            lhash = h
                    fails = 0
                else:
                    fails += 1
            except Exception as e:
                fails += 1
                if fails == 1:
                    print(f" Capture: {e}")
            if fails >= 15:
                self.connected = False
                self.last_error = 'Too many failures'
                return False
            time.sleep(max(0, ESP32Reader._interval - (time.monotonic() - t0)))
        return True

    def _mjpeg(self, sess):
        try:
            r = sess.get(f"{self._url}/stream", stream=True, timeout=(5, 30))
            if r.status_code != 200:
                return False
            print(" MJPEG stream connected")
            self.connected = True
            buf = b''
            n = 0
            for chunk in r.iter_content(4096):
                if not self._run:
                    break
                buf += chunk
                while True:
                    s = buf.find(b'\xff\xd8')
                    if s == -1:
                        buf = buf[-2:]
                        break
                    e = buf.find(b'\xff\xd9', s + 2)
                    if e == -1:
                        buf = buf[s:]
                        break
                    jpg = buf[s:e + 2]
                    buf = buf[e + 2:]
                    arr = np.frombuffer(jpg, np.uint8)
                    if arr.size < 100:
                        continue
                    f = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if f is not None:
                        self._store(jpg, f)
                        n += 1
                if len(buf) > 500000:
                    buf = b''
            return n > 0
        except Exception as e:
            print(f" MJPEG: {e}")
            return False

    def _loop(self):
        sess = requests.Session()
        sess.headers['Connection'] = 'close'
        bo = 0.5
        while self._run:
            self.connected = False
            if self._mjpeg(requests.Session()):
                bo = 0.5
                continue
            self.last_error = f"Unreachable: {self._url}"
            print(f"ESP32 unreachable  retry {bo:.1f}s")
            time.sleep(bo)
            bo = min(bo * 2, 8)


_reader: Optional[ESP32Reader] = None


def _find_esp32(url):
    from concurrent.futures import ThreadPoolExecutor as TPE, as_completed
    from urllib.parse import urlparse as _up

    def chk(ip):
        for port in [81, 80]:
            for path in ['/capture', '/stream']:
                try:
                    r = requests.get(f"http://{ip}:{port}{path}", timeout=1.5)
                    if r.status_code == 200 and len(r.content) > 100:
                        return f"http://{ip}:{port}"
                except BaseException:
                    pass
        return None
    try:
        sub = '.'.join((_up(url).hostname or '192.168.1.1').split('.')[:3])
    except BaseException:
        sub = '192.168.1'
    print(f"Scanning {sub}.x for ESP32...")
    with TPE(50) as p:
        fs = {p.submit(chk, f"{sub}.{i}"): i for i in range(1, 255)}
        for f in as_completed(fs):
            r = f.result()
            if r:
                for x in fs:
                    x.cancel()
                return r
    return url


# ══════════════════════════════════════════════════════════════
#  RECOGNITION WORKER
#  Dedicated background thread — stream never blocks on detection.
#  Throttled to RECOG_MIN_INTERVAL so CPU stays free.
# ══════════════════════════════════════════════════════════════
class RecogWorker:
    def __init__(self, backend):
        self._b = backend
        self._run = False
        self._lock = threading.Lock()
        self._frame: Optional[np.ndarray] = None
        self._results: List[Dict] = []
        self._ts = 0.0
        self._in_ts = 0.0

    def start(self):
        self._run = True
        threading.Thread(target=self._loop, daemon=True, name='recog').start()
        print(" RecogWorker started")

    def stop(self): self._run = False

    def get(self):
        with self._lock:
            return self._frame, list(self._results), self._ts

    def _loop(self):
        while self._run:
            try:
                if _reader is None:
                    time.sleep(0.05)
                    continue
                ts = _reader._ts
                if ts == self._in_ts:
                    time.sleep(0.02)
                    continue
                t0 = time.monotonic()
                self._in_ts = ts
                f = _reader.frame()
                if f is None:
                    time.sleep(0.05)
                    continue
                results, ann = self._b._process_frame(f)
                with self._lock:
                    self._frame = ann
                    self._results = results
                    self._ts = time.monotonic()
                # Throttle: sleep remainder of interval
                elapsed = time.monotonic() - t0
                time.sleep(max(0, RECOG_MIN_INTERVAL - elapsed))
            except Exception as e:
                print(f" RecogWorker: {e}")
                time.sleep(0.1)


# ══════════════════════════════════════════════════════════════
#  TWILIO WHATSAPP SENDER
# ══════════════════════════════════════════════════════════════
class WhatsAppSender:
    """Sends threshold alerts via Twilio WhatsApp API."""

    def __init__(self):
        self._client = None
        self._cooldowns: Dict[str, float] = {}     # rate-limit per alert type
        self._cooldown_sec = 60                      # 1 min between same type
        if TWILIO_AVAILABLE:
            try:
                self._client = TwilioClient(
                    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
                print(f"Twilio WhatsApp ready  {TWILIO_WA_TO}")
            except Exception as e:
                print(f" Twilio init failed: {e}")

    def send(self, alert_type: str, severity: str, summary: str,
             details: Optional[dict] = None, recipient: Optional[str] = None):
        """Send a WhatsApp alert. Non-blocking; errors are logged, not raised."""
        if not self._client:
            return None

        # Rate-limit
        now = time.time()
        if now - self._cooldowns.get(alert_type, 0) < self._cooldown_sec:
            print(f"WhatsApp cooldown for '{alert_type}'  skipped")
            return None

        to = recipient or TWILIO_WA_TO
        emoji = {
            'low': '🟢',
            'medium': '🟡',
            'high': '🟠',
            'critical': '🔴'}.get(
            severity,
            '⚪')

        msg = f"🚨 *AROHAN ALERT — {alert_type}*\n"
        msg += "━━━━━━━━━━━━━━━━━\n"
        msg += f"Severity: {emoji} {severity.upper()}\n"
        if details:
            if details.get('location'):
                msg += f"📍 Location: {details['location']}\n"
            if details.get('temperature') is not None:
                msg += f"🌡️ Temperature: {float(details['temperature']):.1f}°C\n"
            if details.get('humidity') is not None:
                msg += f"💧 Humidity: {float(details['humidity']):.1f}%\n"
            if details.get('mq2') is not None:
                msg += f"💨 Gas MQ-2: {details['mq2']} PPM\n"
            if details.get('mq135') is not None:
                msg += f"🌫️ Air MQ-135: {details['mq135']} PPM\n"
            if details.get('hazardScore') is not None:
                msg += f"☢️ Hazard Score: {float(details['hazardScore']):.1f}/100\n"
            if details.get('battery') is not None:
                msg += f"🔋 Battery: {details['battery']}%\n"
        ts = datetime.now().strftime('%d %b %Y, %I:%M %p')
        msg += f"⏰ Time: {ts}\n"
        msg += f"\n{summary}\n"
        msg += "━━━━━━━━━━━━━━━━━\n"
        msg += "_AROHAN Safety Monitoring System_"

        try:
            result = self._client.messages.create(
                body=msg, from_=TWILIO_WA_FROM, to=to
            )
            self._cooldowns[alert_type] = now
            print(f"WhatsApp sent: {alert_type}  SID {result.sid}")

            # Log to Firebase
            if FIREBASE_AVAILABLE:
                try:
                    fb_db.reference('ronin/whatsapp_logs').push({
                        'alertType': alert_type,
                        'severity': severity,
                        'recipient': to,
                        'messageSid': result.sid,
                        'status': result.status,
                        'timestamp': int(now * 1000),
                        'summary': summary
                    })
                except Exception:
                    pass
            return result
        except Exception as e:
            print(f"WhatsApp failed ({alert_type}): {e}")
            if FIREBASE_AVAILABLE:
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
            return None

    def call(self, alert_type: str, summary: str,
             recipient: Optional[str] = None):
        """Make an emergency voice call with text-to-speech alert."""
        if not self._client:
            print("Voice call skipped: Twilio not initialized")
            return None
        if not TWILIO_CALL_FROM:
            print("Voice call skipped: TWILIO_CALL_FROM not set in .env")
            return None

        # Separate 5-minute cooldown for calls (to save credits)
        now = time.time()
        call_key = f"CALL_{alert_type}"
        if now - self._cooldowns.get(call_key, 0) < 300:  # 5 min
            print(f"Voice call cooldown for '{alert_type}' -- skipped")
            return None

        to = recipient or TWILIO_CALL_TO
        # Build spoken message
        spoken = (
            f"Emergency alert from AROHAN Safety System. "
            f"{alert_type}. {summary}. "
            f"Please check the AROHAN dashboard immediately. "
            f"Repeating. {alert_type}. {summary}."
        )
        # TwiML for text-to-speech
        twiml = (
            f'<Response>'
            f'<Pause length="1"/>'
            f'<Say voice="Polly.Aditi" language="en-IN">{spoken}</Say>'
            f'<Pause length="2"/>'
            f'<Say voice="Polly.Aditi" language="en-IN">{spoken}</Say>'
            f'</Response>'
        )

        try:
            call = self._client.calls.create(
                twiml=twiml,
                to=to,
                from_=TWILIO_CALL_FROM
            )
            self._cooldowns[call_key] = now
            print(
                f"Voice call initiated: {alert_type} -> {to}  SID {call.sid}")

            if FIREBASE_AVAILABLE:
                try:
                    fb_db.reference('ronin/whatsapp_logs').push({
                        'alertType': f'CALL: {alert_type}',
                        'severity': 'critical',
                        'recipient': to,
                        'messageSid': call.sid,
                        'status': call.status,
                        'timestamp': int(now * 1000),
                        'summary': summary
                    })
                except Exception:
                    pass
            return call
        except Exception as e:
            print(f"Voice call failed ({alert_type}): {e}")
            return None


# ══════════════════════════════════════════════════════════════
#  IOT THRESHOLD MONITOR
#  Background thread that watches Firebase /ronin/iot
#  and sends WhatsApp when thresholds are breached.
# ══════════════════════════════════════════════════════════════
class IoTMonitor:
    """Polls Firebase IoT data and triggers WhatsApp on threshold breaches."""

    THRESHOLDS = {
        'flame': {
            'field': 'flame',
            'op': 'bool_true',
            'severity': 'critical',
            'type': 'Fire Detected',
            'msg': '🔥 Flame sensor triggered — immediate evacuation required!'},
        'mq2': {
            'field': 'mq2',
            'op': '>',
            'value': 700,
            'severity': 'high',
            'type': 'Gas Leak',
            'msg': '⚠️ Dangerous gas levels detected'},
        'mq135': {
            'field': 'mq135',
            'op': '>',
            'value': 900,
            'severity': 'medium',
            'type': 'Poor Air Quality',
            'msg': 'Air quality degraded'},
        'temperature': {
            'field': 'temperature',
            'op': '>',
            'value': 40,
            'severity': 'medium',
            'type': 'High Temperature',
                    'msg': '🌡️ Temperature exceeds safe limit'},
        'hazardScore': {
            'field': 'hazardScore',
            'op': '>',
            'value': 60,
            'severity': 'high',
                        'type': 'High Hazard Level',
                        'msg': '☢️ Hazard score critical'},
        'motion': {
            'field': 'motion',
            'op': 'bool_true',
            'severity': 'low',
            'type': 'Motion Detected',
            'msg': '👤 Motion detected in monitored area'},
    }

    def __init__(self, wa_sender: WhatsAppSender):
        self._wa = wa_sender
        self._prev: Dict[str, any] = {}   # previous values for edge-detection
        self._run = False

    def start(self):
        if not FIREBASE_AVAILABLE:
            print("  IoTMonitor: Firebase not available  skipping")
            return
        self._run = True
        threading.Thread(
            target=self._loop,
            daemon=True,
            name='iot-monitor').start()
        print(" IoT Threshold Monitor started")

    def stop(self):
        self._run = False

    def _loop(self):
        while self._run:
            try:
                snap = fb_db.reference('ronin/iot').get()
                if snap and isinstance(snap, dict):
                    self._check(snap)
            except Exception as e:
                print(f" IoTMonitor poll error: {e}")
            time.sleep(5)   # poll every 5 seconds

    def _check(self, data: dict):
        # 1. Check for manual emergency from dashboard
        emergency_active = data.get('emergency', {}).get('active', False)
        prev_emergency = self._prev.get('emergency_active', False)

        if emergency_active and not prev_emergency:
            print("🚨 [IoTMonitor] Dashboard Emergency Activated! Mitigating...")
            # WhatsApp alert
            self._wa.send(
                alert_type="Manual Emergency",
                severity="critical",
                summary="🚨 EMERGENCY MODE ACTIVATED MANUALLY FROM DASHBOARD! Immediate mitigation started.",
                details={
                    'location': 'Command Center'})
            # Voice Call
            threading.Thread(
                target=self._wa.call,
                args=(
                    "Manual Emergency",
                    "Emergency mode has been manually activated from the command center. All safety protocols are engaged."),
                daemon=True).start()
            # Auto-dispatch Rover
            try:
                fb_db.reference(
                    'ronin/rover/control').update({'mode': 'auto', 'direction': 'forward', 'speed': 50})
                fb_db.reference('ronin/rover/mission').update({
                    'state': 'DISPATCHED',
                    'reason': 'Manual Emergency Activation',
                    'dispatchedAt': int(time.time() * 1000),
                    'target': 'Emergency Zone'
                })
            except Exception as e:
                print("Failed to auto-dispatch rover:", e)

        self._prev['emergency_active'] = emergency_active

        # 2. Check all threshold rules
        for key, rule in self.THRESHOLDS.items():
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
                # Voice call for critical/high severity alerts
                if rule['severity'] in ('critical', 'high'):
                    threading.Thread(
                        target=self._wa.call,
                        args=(rule['type'], summary),
                        daemon=True
                    ).start()

            self._prev[field] = cur


# ══════════════════════════════════════════════════════════════
#  ROVER CONTROL BRIDGE
#  Polls Firebase ronin/rover/control and sends HTTP commands
#  to the rover's ESP32 web server. Also syncs rover status
#  and sensor data back to Firebase for the frontend.
# ══════════════════════════════════════════════════════════════
ROVER_URL = os.getenv('ROVER_URL', 'http://192.168.4.1')

# Map frontend direction names → rover HTTP endpoints
_DIR_MAP = {
    'forward': '/forward',
    'back': '/backward',
    'left': '/left',
    'right': '/right',
    'stop': '/stop',
}

# Rover speed range (must match Arduino SPD_MIN/SPD_MAX)
_SPD_MIN = 115
_SPD_MAX = 220


class RoverControlBridge:
    """
    Background thread that bridges Firebase ↔ Rover ESP32 HTTP.

    - Polls ronin/rover/control from Firebase every ~200ms
    - Sends direction/speed commands to rover via HTTP GET
    - Polls rover /sensors + /rstatus every 2 seconds
    - Uploads status + sensor data to Firebase for frontend
    """

    def __init__(self, rover_url: str = ROVER_URL, firebase_ok: bool = False):
        self._url = rover_url.rstrip('/')
        self._fb_ok = firebase_ok and FIREBASE_AVAILABLE
        self._run = False
        self._online = False
        self._sess = requests.Session()
        self._sess.headers['Connection'] = 'keep-alive'

        # Track last-sent values to avoid spamming the rover
        self._last_dir = 'stop'
        self._last_speed = -1
        self._last_mode = 'manual'
        self._last_emergency = False
        self._last_keepalive = 0.0
        # Direct HTTP control (no Firebase needed)
        self._direct_dir = 'stop'
        self._direct_speed = 50
        self._direct_updated = False

    def start(self):
        self._run = True
        # Always start the direct-control loop (works without Firebase)
        threading.Thread(
            target=self._direct_control_loop,
            daemon=True,
            name='rover-direct').start()
        # Only start Firebase polling if available
        if self._fb_ok:
            threading.Thread(
                target=self._control_loop,
                daemon=True,
                name='rover-ctrl').start()
        threading.Thread(
            target=self._status_loop,
            daemon=True,
            name='rover-status').start()
        fb_label = '+Firebase' if self._fb_ok else 'direct-HTTP-only'
        print(f"RoverControlBridge started ({fb_label}) -> {self._url}")

    def stop(self):
        self._run = False

    def set_direct(self, direction: str, speed: int = 50):
        """Called by Flask route — no Firebase needed."""
        self._direct_dir = direction
        self._direct_speed = speed
        self._direct_updated = True

    # ── DIRECT CONTROL LOOP (no Firebase needed) ─────────────────
    def _direct_control_loop(self):
        """Relay direct HTTP commands to rover. Always runs."""
        last_dir = 'stop'
        last_ka = 0.0
        while self._run:
            try:
                d = self._direct_dir
                s = self._direct_speed
                now = time.time()

                # Speed change
                if self._direct_updated:
                    pwm = _SPD_MIN + (s * (_SPD_MAX - _SPD_MIN)) // 100
                    pwm = max(_SPD_MIN, min(_SPD_MAX, pwm))
                    self._send_cmd(f'/speed?v={pwm}')

                if d != last_dir:
                    endpoint = _DIR_MAP.get(d, '/stop')
                    if self._send_cmd(endpoint):
                        print(f"[BRIDGE-DIRECT] {d}")
                        last_dir = d
                        last_ka = now
                    self._direct_updated = False
                elif d != 'stop' and now - last_ka >= 1.5:
                    # Keep-alive to beat rover's 3s watchdog
                    self._send_cmd(_DIR_MAP.get(d, '/stop'))
                    last_ka = now
            except Exception as e:
                print(f"[BRIDGE-DIRECT] err: {e}")
            time.sleep(0.15)

    # ── FIREBASE CONTROL LOOP (only when Firebase available) ─────
    def _control_loop(self):
        """Poll Firebase control commands and relay to rover."""
        while self._run:
            try:
                ref = fb_db.reference('ronin/rover/control')
                ctrl = ref.get()
                if not ctrl or not isinstance(ctrl, dict):
                    time.sleep(0.2)
                    continue

                direction = str(ctrl.get('direction', 'stop')).lower()
                speed_pct = int(ctrl.get('speed', 50))
                mode = str(ctrl.get('mode', 'manual')).lower()
                emergency = bool(ctrl.get('emergency', False))

                # Emergency stop
                if emergency and not self._last_emergency:
                    self._send_cmd('/stop')
                    self._last_dir = 'stop'
                    try:
                        ref.update(
                            {'emergency': False, 'direction': 'stop', 'speed': 0})
                    except Exception:
                        pass
                self._last_emergency = emergency

                if mode != self._last_mode:
                    self._last_mode = mode
                    if mode == 'auto':
                        self._send_cmd('/stop')
                        self._last_dir = 'stop'

                if mode == 'auto':
                    time.sleep(0.2)
                    continue

                # Use direct control path so both FB and HTTP share same state
                self.set_direct(direction, speed_pct)

            except Exception as e:
                print(f"[BRIDGE-FB] err: {e}")

            time.sleep(0.2)

    # ── STATUS LOOP (slow: ~2s) ──────────────────────────────────
    def _status_loop(self):
        """Poll rover sensors/status and sync to Firebase."""
        while self._run:
            try:
                # Poll rover /sensors endpoint
                sensors = self._get_json('/sensors')
                if sensors:
                    self._online = True

                    # Upload sensor data to Firebase
                    try:
                        fb_db.reference('ronin/rover/sensors').set({
                            'mq2': sensors.get('mq2', 0),
                            'mq135': sensors.get('mq135', 0),
                            'temperature': sensors.get('temperature', 0),
                            'humidity': sensors.get('humidity', 0),
                            'timestamp': int(time.time() * 1000),
                        })
                    except Exception as e:
                        print(f" [BRIDGE] Sensor upload: {e}")

                    # Derive location from mission state
                    mission_state = str(sensors.get('ms', 'IDLE'))
                    location = 'Base'
                    if mission_state in ('START', 'PATH'):
                        location = 'En Route'
                    elif mission_state in ('ARRIVE', 'SENSE', 'UPLOAD', 'GASFOLLOW'):
                        location = 'Investigation Site'
                    elif mission_state == 'RETURN':
                        location = 'Returning'
                    elif mission_state == 'DONE':
                        location = 'Base'
                    elif sensors.get('rep', False):
                        location = 'Replaying Path'
                    elif sensors.get('homing', False):
                        location = 'Homing'

                    # Upload status to Firebase
                    try:
                        fb_db.reference('ronin/rover/status').set({
                            'online': True,
                            'battery': 100,  # No battery sensor — hardcoded
                            'location': location,
                            'lastHeartbeat': int(time.time() * 1000),
                        })
                    except Exception as e:
                        print(f" [BRIDGE] Status upload: {e}")

                else:
                    # Rover unreachable
                    if self._online:
                        print(" [BRIDGE] Rover went offline")
                        self._online = False
                        if self._fb_ok:
                            try:
                                fb_db.reference('ronin/rover/status').set({
                                    'online': False,
                                    'battery': 0,
                                    'location': 'Offline',
                                    'lastHeartbeat': int(time.time() * 1000),
                                })
                            except Exception:
                                pass

                # Mission dispatch only works with Firebase
                if self._fb_ok:
                    self._check_mission()

            except Exception as e:
                print(f" [BRIDGE] Status loop error: {e}")

            time.sleep(2)  # 2-second poll for status/sensors

    # ── MISSION COMMANDS ─────────────────────────────────────────
    def _check_mission(self):
        """Check if frontend dispatched a mission and relay to rover."""
        try:
            mission = fb_db.reference('ronin/rover/mission').get()
            if not mission or not isinstance(mission, dict):
                return

            ctrl = fb_db.reference('ronin/rover/control').get()
            mode = 'manual'
            emergency = False
            if isinstance(ctrl, dict):
                mode = str(ctrl.get('mode', 'manual')).lower()
                emergency = bool(ctrl.get('emergency', False))

            state = str(mission.get('state', 'IDLE'))
            # When mission is dispatched from frontend and rover is IDLE, start
            # mission
            if state == 'DISPATCHED' and mode == 'auto' and not emergency:
                rstatus = self._get_json('/rstatus')
                if rstatus and rstatus.get('state') == 'IDLE':
                    if self._send_cmd('/mission'):
                        print(" [BRIDGE] Mission dispatched to rover!")
                        try:
                            fb_db.reference('ronin/rover/mission').update({
                                'state': 'EN_ROUTE',
                                'updatedAt': int(time.time() * 1000),
                            })
                        except Exception:
                            pass

        except Exception as e:
            print(f" [BRIDGE] Mission check error: {e}")

    # ── HTTP HELPERS ─────────────────────────────────────────────
    def _send_cmd(self, endpoint: str) -> bool:
        """Send a command to the rover via HTTP GET."""
        try:
            url = f"{self._url}{endpoint}"
            r = self._sess.get(url, timeout=1.5)
            return r.status_code == 200
        except requests.exceptions.ConnectionError:
            if self._online:
                print(f"[BRIDGE] Rover unreachable at {self._url}")
            self._online = False
            return False
        except Exception as e:
            print(f" [BRIDGE] HTTP error: {e}")
            return False

    def _get_json(self, endpoint: str) -> Optional[dict]:
        """GET JSON from rover endpoint."""
        try:
            url = f"{self._url}{endpoint}"
            r = self._sess.get(url, timeout=2)
            if r.status_code == 200:
                return r.json()
        except requests.exceptions.ConnectionError:
            return None
        except Exception:
            return None
        return None


# ══════════════════════════════════════════════════════════════
#  MAIN BACKEND
# ══════════════════════════════════════════════════════════════
class CVBackend:
    def __init__(self):
        self.app = Flask(__name__)
        CORS(self.app)
        self._lock = threading.Lock()
        self.alerts: List[RoverAlert] = []
        self._alert_ids: set = set()
        self.firebase_ok = False
        self.known_names: List[str] = []
        self.known_encs: List[np.ndarray] = []
        self._enc_mat: Optional[np.ndarray] = None
        self._use_fr = FR_AVAILABLE
        self.det, self.det_mode = load_detector()
        self._cache = EncodeCache(128)
        self._tracker = FaceTracker()
        self._io = ThreadPoolExecutor(2, thread_name_prefix='io')
        self._dbg_count = 0   # frame counter for occasional debug prints

        # WhatsApp sender + IoT monitor
        self._wa = WhatsAppSender()
        self._iot_monitor = IoTMonitor(self._wa)

        global _reader
        cfg = os.getenv('ESP32_CAM_URL', ESP32_URL)
        _reader = ESP32Reader()
        _reader.start(self._check_esp32(cfg))
        self._init_fb()
        self._load_model()
        self._routes()
        self._worker = RecogWorker(self)
        self._worker.start()
        self._iot_monitor.start()

        # Rover control bridge (Firebase ↔ rover HTTP)
        self._rover_bridge = RoverControlBridge(
            rover_url=os.getenv('ROVER_URL', ROVER_URL),
            firebase_ok=self.firebase_ok
        )
        self._rover_bridge.start()

    @staticmethod
    def _check_esp32(url):
        try:
            r = requests.get(url.rstrip('/') + '/capture', timeout=2)
            if r.status_code == 200 and len(r.content) > 100:
                print(f"ESP32 at {url}")
                return url
        except BaseException:
            pass
        return _find_esp32(url)

    def _init_fb(self):
        global FIREBASE_AVAILABLE
        if not FIREBASE_AVAILABLE:
            return
        p = os.getenv('FIREBASE_CREDENTIALS', 'firebase-credentials.json')
        if not os.path.exists(p):
            print(
                f"  Firebase credentials not found: {p} -- Firebase disabled")
            FIREBASE_AVAILABLE = False
            return
        try:
            firebase_admin.initialize_app(credentials.Certificate(p), {
                'databaseURL': os.getenv('FIREBASE_DATABASE_URL', ''),
                'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET', '')})
            self.firebase_ok = True
            print(" Firebase OK")
        except Exception as e:
            print(f" Firebase init failed: {e} -- Firebase disabled")
            FIREBASE_AVAILABLE = False

    def _build_mat(self):
        self._enc_mat = np.stack(self.known_encs) if self.known_encs else None

    def _load_model(self):
        if ENCODINGS_FILE.exists():
            try:
                d = pickle.load(open(ENCODINGS_FILE, 'rb'))
                mode = 'face_recognition' if self._use_fr else 'lbp_hog'
                if d.get('mode') != mode:
                    print("  Mode mismatch  retraining")
                    ENCODINGS_FILE.unlink()
                else:
                    self.known_names = d['names']
                    self.known_encs = d['encodings']
                    self._build_mat()
                    print(f"Loaded {len(self.known_encs)} encodings [{mode}]")
                    # Print per-person count for verification
                    counts = Counter(self.known_names)
                    for n, c in sorted(counts.items()):
                        print(f"   {n}: {c} encodings")
                    return
            except Exception as e:
                print(f" Load failed: {e}")
        self._train()

    # ── TRAINING ─────────────────────────────────────────────────
    # FIX: quality gate REMOVED from training path.
    # Augmented images (esp. blur) are slightly soft — quality gate
    # was rejecting them → only 1-2 encodings per person → Shadan
    # and Shivam encodings too close together → wrong matches.
    # ─────────────────────────────────────────────────────────────
    def _encode_for_training(self, img: np.ndarray,
                             rect: Tuple) -> Optional[np.ndarray]:
        """Encode without quality gate — used ONLY during training."""
        if self._use_fr:
            x, y, w, h = rect
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            encs = fr.face_encodings(rgb, [(y, x + w, y + h, x)])
            return encs[0] if encs else None
        return _lbp_hog_enc(img, rect)

    def _encode_live(self, img: np.ndarray,
                     rect: Tuple) -> Optional[np.ndarray]:
        """Encode with quality gate + cache — used during live recognition."""
        if not _quality_ok(img, rect):
            return None
        cached = self._cache.get(img, rect)
        if cached is not None:
            return cached
        if self._use_fr:
            x, y, w, h = rect
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            encs = fr.face_encodings(rgb, [(y, x + w, y + h, x)])
            enc = encs[0] if encs else None
        else:
            enc = _lbp_hog_enc(img, rect)
        if enc is not None:
            self._cache.put(img, rect, enc)
        return enc

    def _train(self):
        pairs = []
        for item in sorted(KNOWN_DIR.iterdir()):
            if item.is_dir():
                for img in sorted(item.glob('*')):
                    if img.suffix.lower() in {'.jpg', '.jpeg', '.png', '.bmp'}:
                        pairs.append((item.name, img))
            elif item.suffix.lower() in {'.jpg', '.jpeg', '.png', '.bmp'}:
                pairs.append((item.stem, item))
        if not pairs:
            print("  No images in known_faces/")
            return

        mode = 'face_recognition' if self._use_fr else 'lbp_hog'
        print(f"\n Training [{mode}]  {len(pairs)} image(s)...")
        names, encs = [], []

        for name, path in pairs:
            try:
                pil = Image.open(path).convert('RGB')
                img = cv2.cvtColor(np.array(pil, np.uint8), cv2.COLOR_RGB2BGR)
                # Normalize ONCE before augmentation
                img = _enhance(img)
            except Exception as e:
                print(f"    Read {path.name}: {e}")
                continue

            faces = detect_faces(img, self.det, self.det_mode)
            if not faces:
                print(f"    No face: {path.name}")
                continue
            rect = tuple(max(faces, key=lambda f: f[2] * f[3]))

            # Augment the already-normalized image
            # FIX: do NOT re-normalize augments (causes double processing)
            augments = [
                img,                                          # original
                cv2.flip(img, 1),                             # horizontal flip
                np.clip(
                    img.astype(
                        np.int16) -
                    35,
                    0,
                    255).astype(
                    np.uint8),
                # darker
                np.clip(
                    img.astype(
                        np.int16) +
                    35,
                    0,
                    255).astype(
                    np.uint8),
                # brighter
                cv2.GaussianBlur(img, (3, 3), 0),               # slight blur
            ]

            added = 0
            for aug in augments:
                enc = self._encode_for_training(aug, rect)   # no quality gate
                if enc is not None:
                    names.append(name)
                    encs.append(enc)
                    added += 1

            print(f"   {name}  {path.name}  ({added}/5 variants)")

        self.known_names = names
        self.known_encs = encs
        self._build_mat()

        if encs:
            pickle.dump({'names': names,
                         'encodings': encs,
                         'mode': mode,
                         'trained_at': datetime.now().isoformat(),
                         'num_people': len(set(names)),
                         'num_encodings': len(encs)},
                        open(ENCODINGS_FILE,
                             'wb'))
            counts = Counter(names)
            print(f"Saved  {len(encs)} encodings, {len(set(names))} people")
            for n, c in sorted(counts.items()):
                print(f"   {n}: {c} encodings")
            print()

    def reload(self):
        ENCODINGS_FILE.unlink(missing_ok=True)
        self._tracker.clear()
        self._cache.clear()
        self._train()

    # ── RECOGNITION ──────────────────────────────────────────────
    def _snap(self):
        with self._lock:
            return self._enc_mat, list(self.known_names), self._use_fr

    def _recognize(self, img, bbox, mat=None, names=None, use_fr=None):
        if mat is None:
            mat, names, use_fr = self._snap()
        if mat is None or not names:
            return False, None, 0.0
        enc = self._encode_live(img, bbox)
        if enc is None:
            return False, None, 0.0

        na = np.array(names)
        uniq = list(dict.fromkeys(names))

        if use_fr:
            dists = np.linalg.norm(mat - enc, axis=1)
            pn = [(n, float(dists[na == n].min())) for n in uniq]
            best, dist = min(pn, key=lambda x: x[1])
            conf = max(0.0, 1.0 - dist)
            ok = dist <= FR_THRESH
            # Occasional debug (every 30 frames)
            self._dbg_count += 1
            if self._dbg_count % 30 == 0:
                print(f"[FR] {[(n, f'{d:.3f}') for n, d in sorted(
                    pn, key=lambda x: x[1])[:3]]} " f"→ {'✅' if ok else '❌'} {best}")
            return ok, best if ok else None, round(conf, 3)

        en = enc / (np.linalg.norm(enc) + 1e-9)
        mn = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)
        sims = mn @ en
        pn = [(n, float(sims[na == n].max())) for n in uniq]
        best, sim = max(pn, key=lambda x: x[1])
        ok = sim >= LBP_THRESH
        self._dbg_count += 1
        if self._dbg_count % 30 == 0:
            print(f"[LBP] {[(n, f'{s:.3f}') for n, s in sorted(
                pn, key=lambda x: x[1], reverse=True)[:3]]} " f"→ {'✅' if ok else '❌'} {best}")
        return ok, best if ok else None, round(float(sim), 3)

    def _process_frame(self, frame):
        mat, names, use_fr = self._snap()
        fh, fw = frame.shape[:2]
        raw = detect_faces(frame, self.det, self.det_mode)
        dets = []
        res = []
        for x, y, w, h in raw:
            x1, y1 = max(0, x), max(0, y)
            x2, y2 = min(fw, x + w), min(fh, y + h)
            if x2 - x1 < 20 or y2 - y1 < 20:
                continue
            ok, name, conf = self._recognize(
                frame, (x1, y1, x2 - x1, y2 - y1), mat, names, use_fr)
            dets.append([x1, y1, x2 - x1, y2 - y1])
            res.append((name, conf))

        tracked = self._tracker.update(dets, res)
        results = []
        for rect, (tid, vname, vconf) in zip(dets, tracked):
            x1, y1, w, h = rect
            results.append({'x': x1, 'y': y1, 'w': w, 'h': h,
                            'name': vname, 'confidence': vconf,
                            'is_known': vname is not None, 'track_id': tid})
        return results, annotate(frame, results)

    def _analyze(self, frame):
        ts = datetime.now().isoformat()
        results, ann = self._process_frame(frame)
        if not results:
            if self._detect_accident(frame):
                return self._accident(frame, ts)
            return {'status': 'success', 'message': 'No faces', 'faces': []}
        fname = f"snap_{int(time.time())}.jpg"
        spath = SNAP_DIR / fname
        self._io.submit(self._save_snap, ann, spath, fname)
        url = f"{BACKEND_URL}/static/snapshots/{fname}"
        alerts = []
        for i, r in enumerate(results):
            tp = 'KNOWN_FACE' if r['is_known'] else 'UNKNOWN_FACE'
            msg = f"Known: {r['name']}" if r['is_known'] else "Unknown person"
            a = RoverAlert(id=f"a_{int(time.time() * 1000)}_{i}_{uuid.uuid4().hex[:8]}",
                           type=tp,
                           message=msg,
                           createdAt=ts,
                           confidence=r['confidence'],
                           snapshotUrl=url,
                           meta={'faces': len(results),
                                 'box': {k: r[k] for k in 'xywh'}})
            self._add_alert(a)
            self._io.submit(self._fb_alert, a)
            alerts.append(asdict(a))
        return {'status': 'success', 'faces_detected': len(results),
                'faces': results, 'alerts': alerts, 'snapshot_url': url}

    # ── ROUTES ───────────────────────────────────────────────────
    def _routes(self):

        @self.app.route('/health')
        def health():
            ok = _reader.connected if _reader else False
            counts = Counter(self.known_names)
            return jsonify({
                'status': 'healthy',
                'detector': self.det_mode,
                'recognizer': 'face_recognition' if self._use_fr else 'lbp_hog',
                'known_faces': len(set(self.known_names)),
                'per_person_encodings': {n: c for n, c in counts.items()},
                'total_encodings': len(self.known_encs),
                'esp32_connected': ok,
                'esp32_frames': _reader.frame_count if _reader else 0,
                'esp32_error': '' if ok else (_reader.last_error if _reader else ''),
                'threshold': FR_THRESH if self._use_fr else LBP_THRESH,
            })

        @self.app.route('/')
        def index():
            return jsonify({'service': 'AROHAN CV Backend FINAL'})

        @self.app.route('/update-esp32-url', methods=['POST'])
        def upd_url():
            u = (request.get_json() or {}).get('url', '').strip()
            if not u:
                return jsonify({'error': 'url required'}), 400
            if _reader:
                _reader.update_url(u)
            return jsonify({'status': 'ok', 'url': u})

        @self.app.route('/analyze-frame', methods=['POST'])
        def analyze():
            try:
                d = request.get_json() or {}
                src = d.get('source', 'esp32')
                if src == 'base64':
                    b64 = d.get('image', '')
                    if not b64:
                        return jsonify({'error': 'no image'}), 400
                    if ',' in b64:
                        b64 = b64.split(',', 1)[1]
                    arr = np.frombuffer(base64.b64decode(b64), np.uint8)
                    f = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if f is None:
                        return jsonify({'error': 'decode fail'}), 400
                    f = _enhance(f)
                elif src == 'esp32':
                    f = _reader.frame() if _reader else None
                    if f is None:
                        return jsonify({'error': 'no frame'}), 500
                else:
                    return jsonify({'error': 'bad source'}), 400
                return jsonify(self._analyze(f))
            except Exception as e:
                import traceback
                traceback.print_exc()
                return jsonify({'error': str(e)}), 500

        @self.app.route('/annotated-frame')
        def ann_frame():
            try:
                f = _reader.frame() if _reader else None
                if f is None:
                    return jsonify({'error': 'no frame'}), 500
                _, ann = self._process_frame(f)
                ok, buf = cv2.imencode(
                    '.jpg', ann, [
                        cv2.IMWRITE_JPEG_QUALITY, 95])
                return Response(buf.tobytes(), mimetype='image/jpeg',
                                headers={'Cache-Control': 'no-cache',
                                         'Access-Control-Allow-Origin': '*'})
            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @self.app.route('/alerts')
        def get_alerts():
            return jsonify([asdict(a) for a in sorted(
                self.alerts, key=lambda a: a.createdAt, reverse=True)[:50]])

        @self.app.route('/stream-annotated')
        def stream_ann():
            def gen():
                last_ts = 0.0
                last_alert: Dict[str, float] = {}
                blank = False
                while True:
                    try:
                        ann, res, ts = self._worker.get()
                        if ann is None:
                            if not blank:
                                err = np.zeros((480, 640, 3), np.uint8)
                                cv2.putText(
                                    err, "Waiting for ESP32...", (120, 240), FONT, 1.0, (180, 180, 180), 2)
                                ok, enc = cv2.imencode('.jpg', err)
                                if ok:
                                    yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + enc.tobytes() + b'\r\n'
                                blank = True
                            time.sleep(0.1)
                            continue
                        if ts == last_ts:
                            time.sleep(0.02)
                            continue
                        last_ts = ts
                        blank = False
                        now = time.time()
                        for i, face in enumerate(res):
                            pid = face.get('name') or f"unk_{i}"
                            if now - last_alert.get(pid, 0) > 5:
                                self._stream_alert(face, res, ann, int(now))
                                last_alert[pid] = now
                        hud = ann.copy()
                        ns = [r['name'] for r in res if r['name']]
                        txt = f"Faces:{len(res)}" + \
                            (f"  {', '.join(ns)}" if ns else "")
                        cv2.putText(hud, txt, (10, 25), FONT, 0.6,
                                    (255, 255, 255), 1, cv2.LINE_AA)
                        hud = cv2.rotate(hud, cv2.ROTATE_180)
                        ok, enc = cv2.imencode(
                            '.jpg', hud, [cv2.IMWRITE_JPEG_QUALITY, 92])
                        if ok:
                            yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + enc.tobytes() + b'\r\n'
                    except GeneratorExit:
                        break
                    except Exception as e:
                        print(f" stream: {e}")
                        time.sleep(0.5)
            return Response(
                gen(),
                mimetype='multipart/x-mixed-replace; boundary=frame',
                headers={
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*'})

        @self.app.route('/stream-raw')
        def stream_raw():
            def gen():
                lt = 0.0
                while True:
                    try:
                        raw = _reader.raw_jpg() if _reader else None
                        ts = _reader._ts if _reader else 0.0
                        if raw is None or ts == lt:
                            time.sleep(0.02)
                            continue
                        lt = ts
                        arr = np.frombuffer(raw, np.uint8)
                        f = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if f is not None:
                            f = cv2.rotate(f, cv2.ROTATE_180)
                            ok, buf = cv2.imencode(
                                '.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 88])
                            if ok:
                                yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n'
                    except GeneratorExit:
                        break
                    except BaseException:
                        time.sleep(0.5)
            return Response(
                gen(),
                mimetype='multipart/x-mixed-replace; boundary=frame',
                headers={
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*'})

        @self.app.route('/alerts', methods=['POST'])
        def add_alert():
            try:
                a = RoverAlert(**request.get_json())
                self._add_alert(a)
                return jsonify({'status': 'ok', 'id': a.id})
            except Exception as e:
                return jsonify({'error': str(e)}), 400

        @self.app.route('/reload-faces', methods=['POST'])
        def reload():
            try:
                with self._lock:
                    self.reload()
                return jsonify({'status': 'ok',
                                'known_people': sorted(set(self.known_names)),
                                'encodings': len(self.known_encs)})
            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @self.app.route('/add-face', methods=['POST'])
        def add_face():
            try:
                d = request.get_json() or {}
                name = d.get('name', '').strip()
                b64 = d.get('image', '')
                if not name:
                    return jsonify({'error': 'name required'}), 400
                if not b64:
                    return jsonify({'error': 'image required'}), 400
                if ',' in b64:
                    b64 = b64.split(',', 1)[1]
                arr = np.frombuffer(base64.b64decode(b64), np.uint8)
                f = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if f is None:
                    return jsonify({'error': 'decode fail'}), 400
                f = _enhance(f)
                faces = detect_faces(f, self.det, self.det_mode)
                if not faces:
                    return jsonify({'error': 'no face detected'}), 400
                pd = KNOWN_DIR / name
                pd.mkdir(parents=True, exist_ok=True)
                fp = pd / f"{name}_{len(list(pd.glob('*.jpg'))) + 1:03d}.jpg"
                cv2.imwrite(str(fp), f)
                with self._lock:
                    self.reload()
                return jsonify({'status': 'ok', 'name': name,
                                'known_people': sorted(set(self.known_names)),
                                'encodings': len(self.known_encs)})
            except Exception as e:
                import traceback
                traceback.print_exc()
                return jsonify({'error': str(e)}), 500

        @self.app.route('/known-faces')
        def known():
            people = {}
            for item in sorted(KNOWN_DIR.iterdir()):
                if item.is_dir():
                    people[item.name] = len(
                        list(item.glob('*.jpg')) + list(item.glob('*.png')))
                elif item.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
                    people[item.stem] = people.get(item.stem, 0) + 1
            return jsonify({'known_people': sorted(set(self.known_names)),
                            'face_images': people,
                            'total_encodings': len(self.known_encs)})

        @self.app.route('/static/snapshots/<f>')
        def snap(f): return send_from_directory(str(SNAP_DIR), f)

        @self.app.route('/send-test-whatsapp', methods=['POST'])
        def test_whatsapp():
            try:
                result = self._wa.send(
                    alert_type='Test Message',
                    severity='low',
                    summary='This is a test -- WhatsApp alerts are working!',
                    details={'location': 'System'}
                )
                if result:
                    return jsonify({'success': True, 'messageSid': result.sid,
                                    'status': result.status,
                                    'message': 'Test WhatsApp message sent!'})
                return jsonify({'success': False,
                                'message': 'Failed -- check Twilio credentials & sandbox opt-in'}), 500
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)}), 500

        @self.app.route('/test-call', methods=['POST'])
        def test_call():
            """Test emergency voice call."""
            try:
                result = self._wa.call(
                    alert_type='Test Call',
                    summary='This is a test call from AROHAN safety system.'
                )
                if result:
                    return jsonify({'success': True, 'callSid': result.sid,
                                    'status': result.status})
                return jsonify({'success': False,
                                'message': 'Failed -- check TWILIO_CALL_FROM in .env and verified caller IDs'}), 500
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)}), 500
        # ── DIRECT ROVER CONTROL (no Firebase needed) ────────────

        @self.app.route('/rover/control', methods=['POST'])
        def rover_control():
            """Send command IMMEDIATELY to rover — no polling delay."""
            try:
                d = request.get_json() or {}
                direction = str(d.get('direction', 'stop')).lower()
                speed_pct = int(d.get('speed', 50))
                if direction not in (
                        'forward', 'back', 'left', 'right', 'stop'):
                    return jsonify({'error': 'invalid direction'}), 400
                # Send speed
                pwm = _SPD_MIN + (speed_pct * (_SPD_MAX - _SPD_MIN)) // 100
                pwm = max(_SPD_MIN, min(_SPD_MAX, pwm))
                self._rover_bridge._send_cmd(f'/speed?v={pwm}')
                # Send direction immediately to rover
                endpoint = _DIR_MAP.get(direction, '/stop')
                ok = self._rover_bridge._send_cmd(endpoint)
                # Update state for keep-alive loop
                self._rover_bridge.set_direct(direction, speed_pct)
                return jsonify({'ok': ok, 'direction': direction})
            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @self.app.route('/rover/stop', methods=['POST', 'GET'])
        def rover_stop():
            self._rover_bridge._send_cmd('/stop')
            self._rover_bridge.set_direct('stop', 0)
            return jsonify({'ok': True, 'direction': 'stop'})

    # ── HELPERS ──────────────────────────────────────────────────
    def _stream_alert(self, face, all_faces, ann, fc):
        ts = datetime.now().isoformat()
        tp = 'KNOWN_FACE' if face['is_known'] else 'UNKNOWN_FACE'
        msg = f"Known: {
            face['name']}" if face['is_known'] else "Unknown person"
        fname = f"snap_{int(time.time())}_{fc}.jpg"
        url = f"{BACKEND_URL}/static/snapshots/{fname}"
        a = RoverAlert(id=f"a_{int(time.time() * 1000)}_{fc}_{uuid.uuid4().hex[:8]}",
                       type=tp,
                       message=msg,
                       createdAt=ts,
                       confidence=face['confidence'],
                       snapshotUrl=url,
                       meta={'faces': len(all_faces),
                             'box': {k: face[k] for k in 'xywh'}})
        self._add_alert(a)
        self._io.submit(self._save_snap, ann.copy(), SNAP_DIR / fname, fname)
        self._io.submit(self._fb_alert, a)

    def _add_alert(self, a):
        if a.id in self._alert_ids:
            return
        self._alert_ids.add(a.id)
        self.alerts.append(a)
        if len(self.alerts) > MAX_ALERTS:
            old = self.alerts[:len(self.alerts) - MAX_ALERTS]
            self.alerts = self.alerts[-MAX_ALERTS:]
            recent = {x.snapshotUrl for x in self.alerts if x.snapshotUrl}
            for o in old:
                self._alert_ids.discard(o.id)
                if o.snapshotUrl and o.snapshotUrl not in recent:
                    if '/snapshots/' in (o.snapshotUrl or ''):
                        p = SNAP_DIR / o.snapshotUrl.split('/snapshots/')[-1]
                        if p.exists():
                            try:
                                p.unlink()
                            except BaseException:
                                pass

    def _save_snap(self, frame, path, fname):
        snaps = sorted(SNAP_DIR.glob('*.jpg'), key=lambda p: p.stat().st_mtime)
        for s in snaps[:max(0, len(snaps) - MAX_SNAPSHOTS)]:
            try:
                s.unlink()
            except BaseException:
                pass
        cv2.imwrite(str(path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        self._fb_snap(path, fname)

    def _fb_snap(self, path, fname):
        if not self.firebase_ok:
            return
        try:
            b = storage.bucket().blob(f'ronin/snapshots/{fname}')
            b.upload_from_filename(str(path))
            b.make_public()
        except Exception as e:
            print(f" FB upload: {e}")

    def _fb_alert(self, a):
        if not self.firebase_ok:
            return
        try:
            fb_db.reference('ronin/alerts').push(asdict(a))
        except Exception as e:
            print(f" FB alert: {e}")

    def _accident(self, frame, ts):
        fname = f"snap_{int(time.time())}.jpg"
        url = f"{BACKEND_URL}/static/snapshots/{fname}"
        self._io.submit(self._save_snap, frame.copy(), SNAP_DIR / fname, fname)
        a = RoverAlert(id=f"a_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}",
                       type='ACCIDENT',
                       message='Potential accident',
                       createdAt=ts,
                       confidence=0.6,
                       snapshotUrl=url,
                       meta={'faces': 0})
        self._add_alert(a)
        self._io.submit(self._fb_alert, a)
        return {'status': 'success', 'alert': asdict(a), 'faces': []}

    def _detect_accident(self, frame):
        try:
            g = cv2.cvtColor(
                frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
            b = np.mean(g)
            if b < 30 or b > 200:
                return True
            return cv2.Laplacian(
                g, cv2.CV_64F).var() < float(
                os.getenv(
                    'BLUR_THRESHOLD', '10'))
        except BaseException:
            return False

    def run(self, host='0.0.0.0', port=5000, debug=False):
        rec = 'FaceNet' if self._use_fr else 'LBP+HOG'
        eu = _reader._url if _reader else ESP32_URL
        wa_ok = bool(self._wa._client)
        print(f"\n AROHAN CV Backend FINAL    http://{host}:{port}")
        print(f"ESP32     : {eu}")
        print(f"Detector  : {self.det_mode.upper()}")
        print(f"Recognizer: {rec}")
        print(f"People    : {sorted(set(self.known_names)) or 'none'}")
        print(
            f"WhatsApp  : {
                'ACTIVE' if wa_ok else 'DISABLED'}  {TWILIO_WA_TO}")
        print(
            f"Rover Ctrl: {
                self._rover_bridge._url} (direct HTTP + {
                'Firebase' if self._rover_bridge._fb_ok else 'no-FB'})")
        print(
            f"RecogWorker throttled to {
                1 / RECOG_MIN_INTERVAL:.0f} fps max\n")
        self.app.run(host=host, port=port, debug=debug,
                     threaded=True, use_reloader=False)


if __name__ == '__main__':
    CVBackend().run(port=int(os.getenv('PORT', '5000')))
