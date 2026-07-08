"""
=================================================================
 AROHAN Rover — Face Recognition Server
 
 Flask API that uses OpenCV-based face detection and encoding
 (no dlib dependency). Works with train_faces.py.

 Usage:
   python face_recognition_server.py

 Endpoints:
   GET  /                    → Server status
   POST /recognize           → Send image, get face recognition results
   POST /capture_training    → Capture image from ESP32-CAM for training
   POST /train               → Re-train the model from dataset/ images  
   GET  /enrolled            → List all enrolled people
   DELETE /enrolled/<name>   → Remove a person from dataset
=================================================================
"""

import os
import sys
import io
import pickle
import time
import shutil
import subprocess
import threading

import cv2
import numpy as np
from PIL import Image
import requests as req_lib
from flask import Flask, request, jsonify
from flask_cors import CORS

# ── PATHS ──────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(SCRIPT_DIR, "dataset")
MODEL_DIR = os.path.join(SCRIPT_DIR, "trained_model")
ENCODINGS_FILE = os.path.join(MODEL_DIR, "encodings.pkl")

# ── CONFIG ─────────────────────────────────────────────────────────
RECOGNITION_THRESHOLD = 0.85  # Cosine similarity — higher = stricter match
SERVER_PORT = 5000

# ── FLASK APP ──────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ── GLOBAL STATE ───────────────────────────────────────────────────
known_names = []
known_encodings = []
model_info = {}
training_lock = threading.Lock()

# ── FACE DETECTOR ──────────────────────────────────────────────────
FACE_DETECTOR = None


def get_face_detector():
    """Get or create OpenCV Haar cascade face detector."""
    global FACE_DETECTOR
    if FACE_DETECTOR is None:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        FACE_DETECTOR = cv2.CascadeClassifier(cascade_path)
    return FACE_DETECTOR


def detect_faces_cv(image):
    """Detect faces using OpenCV. Returns list of (x, y, w, h)."""
    detector = get_face_detector()
    
    # Fast path: resize image for faster detection
    height, width = image.shape[:2]
    compute_width = 400  # Smaller = much faster
    scale = width / compute_width
    
    small_image = cv2.resize(image, (compute_width, int(height / scale)))
    
    gray = cv2.cvtColor(small_image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    
    faces = detector.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=4,  # slightly less strict for speed
        minSize=(30, 30),
        flags=cv2.CASCADE_SCALE_IMAGE
    )
    
    # Scale boxes back to original size
    scaled_faces = []
    for (x, y, w, h) in faces:
        scaled_faces.append([int(x * scale), int(y * scale), int(w * scale), int(h * scale)])
        
    return scaled_faces


def compute_face_encoding(image, face_rect):
    """
    Compute face encoding using LBP + HOG + color histograms.
    Must match the same function in train_faces.py.
    """
    x, y, w, h = face_rect
    
    pad = int(0.1 * max(w, h))
    y1 = max(0, y - pad)
    y2 = min(image.shape[0], y + h + pad)
    x1 = max(0, x - pad)
    x2 = min(image.shape[1], x + w + pad)
    
    face_roi = image[y1:y2, x1:x2]
    face_resized = cv2.resize(face_roi, (128, 128))
    
    features = []
    
    # 1. LBP histogram
    gray_face = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)
    lbp = np.zeros_like(gray_face, dtype=np.uint8)
    for i in range(1, gray_face.shape[0] - 1):
        for j in range(1, gray_face.shape[1] - 1):
            center = gray_face[i, j]
            code = 0
            code |= (1 << 7) if gray_face[i-1, j-1] >= center else 0
            code |= (1 << 6) if gray_face[i-1, j] >= center else 0
            code |= (1 << 5) if gray_face[i-1, j+1] >= center else 0
            code |= (1 << 4) if gray_face[i, j+1] >= center else 0
            code |= (1 << 3) if gray_face[i+1, j+1] >= center else 0
            code |= (1 << 2) if gray_face[i+1, j] >= center else 0
            code |= (1 << 1) if gray_face[i+1, j-1] >= center else 0
            code |= (1 << 0) if gray_face[i, j-1] >= center else 0
            lbp[i, j] = code
    
    cell_h, cell_w = lbp.shape[0] // 4, lbp.shape[1] // 4
    for ci in range(4):
        for cj in range(4):
            cell = lbp[ci*cell_h:(ci+1)*cell_h, cj*cell_w:(cj+1)*cell_w]
            hist, _ = np.histogram(cell, bins=32, range=(0, 256))
            hist = hist.astype(np.float64)
            s = hist.sum()
            if s > 0:
                hist /= s
            features.extend(hist)
    
    # 2. Color histogram (HSV)
    hsv_face = cv2.cvtColor(face_resized, cv2.COLOR_BGR2HSV)
    for ch in range(3):
        hist = cv2.calcHist([hsv_face], [ch], None, [32], [0, 256])
        hist = hist.flatten().astype(np.float64)
        s = hist.sum()
        if s > 0:
            hist /= s
        features.extend(hist)
    
    # 3. HOG gradient features
    gx = cv2.Sobel(gray_face, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray_face, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(gx**2 + gy**2)
    angle = np.arctan2(gy, gx) * 180 / np.pi + 180
    
    for ci in range(4):
        for cj in range(4):
            cell_mag = magnitude[ci*cell_h:(ci+1)*cell_h, cj*cell_w:(cj+1)*cell_w]
            cell_ang = angle[ci*cell_h:(ci+1)*cell_h, cj*cell_w:(cj+1)*cell_w]
            hist, _ = np.histogram(cell_ang, bins=9, range=(0, 360), weights=cell_mag)
            hist = hist.astype(np.float64)
            s = hist.sum()
            if s > 0:
                hist /= s
            features.extend(hist)
    
    encoding = np.array(features, dtype=np.float64)
    norm = np.linalg.norm(encoding)
    if norm > 0:
        encoding /= norm
    
    return encoding


def cosine_similarity(a, b):
    """Compute cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def load_model():
    """Load trained face encodings from pickle file."""
    global known_names, known_encodings, model_info

    if not os.path.isfile(ENCODINGS_FILE):
        print("⚠️  No trained model found. Run 'python train_faces.py' first.")
        known_names = []
        known_encodings = []
        model_info = {}
        return False

    with open(ENCODINGS_FILE, "rb") as f:
        data = pickle.load(f)

    known_names = data["names"]
    known_encodings = data["encodings"]
    model_info = {
        "trained_at": data.get("trained_at", "Unknown"),
        "num_people": data.get("num_people", len(set(known_names))),
        "num_encodings": data.get("num_encodings", len(known_encodings)),
        "people": sorted(set(known_names)),
    }

    print(f"✅ Model loaded: {len(known_encodings)} encodings, "
          f"{len(set(known_names))} people")
    print(f"   People: {', '.join(sorted(set(known_names)))}")
    return True


def image_from_request():
    """Extract image from request."""
    if "image" in request.files:
        file = request.files["image"]
        img_bytes = file.read()
    elif request.data:
        img_bytes = request.data
    else:
        return None

    try:
        pil_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        image = cv2.cvtColor(np.array(pil_image, dtype=np.uint8), cv2.COLOR_RGB2BGR)
    except Exception:
        nparr = np.frombuffer(img_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return image


# ══════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "running",
        "service": "AROHAN Face Recognition Server (OpenCV)",
        "model_loaded": len(known_encodings) > 0,
        "model_info": model_info,
        "endpoints": {
            "POST /recognize": "Send an image to recognize faces",
            "POST /capture_training": "Capture from ESP32-CAM for training",
            "POST /train": "Re-train the model",
            "GET /enrolled": "List enrolled people",
            "DELETE /enrolled/<name>": "Remove a person",
        }
    })


@app.route("/recognize", methods=["POST"])
def recognize():
    """Recognize faces in an uploaded image."""
    start = time.time()

    image = image_from_request()
    if image is None:
        return jsonify({"error": "No image provided"}), 400

    # Detect faces
    faces = detect_faces_cv(image)

    if len(faces) == 0:
        elapsed = (time.time() - start) * 1000
        return jsonify({
            "faces": [],
            "count": 0,
            "processing_time_ms": round(elapsed, 1)
        })

    results = []
    for (x, y, w, h) in faces:
        name = "Unknown"
        confidence = 0.0

        if known_encodings:
            # Compute encoding for this face
            encoding = compute_face_encoding(image, (x, y, w, h))
            
            # Compare against all known faces using cosine similarity
            best_similarity = -1
            best_name = "Unknown"
            
            for known_enc, known_name in zip(known_encodings, known_names):
                sim = cosine_similarity(encoding, known_enc)
                if sim > best_similarity:
                    best_similarity = sim
                    best_name = known_name
            
            if best_similarity >= RECOGNITION_THRESHOLD:
                name = best_name
                confidence = round(best_similarity * 100, 1)

        results.append({
            "name": name,
            "confidence": confidence,
            "location": {
                "top": int(y),
                "right": int(x + w),
                "bottom": int(y + h),
                "left": int(x)
            }
        })

    elapsed = (time.time() - start) * 1000
    return jsonify({
        "faces": results,
        "count": len(results),
        "processing_time_ms": round(elapsed, 1)
    })


@app.route("/capture_training", methods=["POST"])
def capture_training():
    """Capture a training image."""
    name = None
    image = None

    if request.content_type and "multipart" in request.content_type:
        name = request.form.get("name", "").strip()
        if "image" in request.files:
            file = request.files["image"]
            img_bytes = file.read()
            try:
                pil_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                image = cv2.cvtColor(np.array(pil_image, dtype=np.uint8), cv2.COLOR_RGB2BGR)
            except Exception:
                nparr = np.frombuffer(img_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    else:
        data = request.get_json(force=True, silent=True) or {}
        name = data.get("name", "").strip()
        esp32_ip = data.get("esp32_ip", "").strip()
        esp32_port = data.get("esp32_port", "81").strip()

        if esp32_ip:
            url = f"http://{esp32_ip}:{esp32_port}/capture_hires"
            try:
                resp = req_lib.get(url, timeout=5)
                resp.raise_for_status()
                nparr = np.frombuffer(resp.content, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception as e:
                return jsonify({"error": f"Failed to capture from ESP32-CAM: {str(e)}"}), 500

    if not name:
        return jsonify({"error": "Name is required"}), 400

    if image is None:
        return jsonify({"error": "No image provided or captured"}), 400

    # Verify face exists
    faces = detect_faces_cv(image)
    if len(faces) == 0:
        return jsonify({"error": "No face detected. Try better lighting/angle."}), 400

    # Save to dataset
    person_dir = os.path.join(DATASET_DIR, name)
    os.makedirs(person_dir, exist_ok=True)

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    existing = len([f for f in os.listdir(person_dir) if f.endswith((".jpg", ".png"))])
    filename = f"{name}_{timestamp}_{existing + 1}.jpg"
    filepath = os.path.join(person_dir, filename)

    cv2.imwrite(filepath, image)

    return jsonify({
        "success": True,
        "message": f"Saved training image for '{name}'",
        "filename": filename,
        "faces_detected": len(faces),
        "total_images": existing + 1,
        "note": "Run /train to update the model."
    })


@app.route("/train", methods=["POST"])
def train_model():
    """Re-train the model."""
    if not training_lock.acquire(blocking=False):
        return jsonify({"error": "Training already in progress."}), 409

    try:
        train_script = os.path.join(SCRIPT_DIR, "train_faces.py")
        if not os.path.isfile(train_script):
            return jsonify({"error": "train_faces.py not found"}), 500

        result = subprocess.run(
            [sys.executable, train_script],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode != 0:
            return jsonify({
                "success": False,
                "error": "Training failed",
                "output": result.stdout + result.stderr
            }), 500

        load_model()

        return jsonify({
            "success": True,
            "message": "Model trained successfully!",
            "model_info": model_info,
            "output": result.stdout
        })

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Training timed out (5 min limit)"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        training_lock.release()


@app.route("/enrolled", methods=["GET"])
def list_enrolled():
    """List all enrolled people."""
    people = {}

    if os.path.isdir(DATASET_DIR):
        for person_name in sorted(os.listdir(DATASET_DIR)):
            person_dir = os.path.join(DATASET_DIR, person_name)
            if not os.path.isdir(person_dir) or person_name.startswith("."):
                continue
            images = [f for f in os.listdir(person_dir)
                      if os.path.splitext(f)[1].lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}]
            people[person_name] = {
                "image_count": len(images),
                "images": images
            }

    return jsonify({
        "people": people,
        "total_people": len(people),
        "model_loaded": len(known_encodings) > 0,
        "model_info": model_info
    })


@app.route("/enrolled/<name>", methods=["DELETE"])
def delete_enrolled(name):
    """Remove a person's training data."""
    person_dir = os.path.join(DATASET_DIR, name)

    if not os.path.isdir(person_dir):
        return jsonify({"error": f"Person '{name}' not found"}), 404

    shutil.rmtree(person_dir)
    return jsonify({
        "success": True,
        "message": f"Deleted all training data for '{name}'",
        "note": "Run /train to update the model."
    })


# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("  🤖 AROHAN Face Recognition Server")
    print("  📦 Using OpenCV (no dlib dependency)")
    print("=" * 60)
    print()

    os.makedirs(DATASET_DIR, exist_ok=True)
    os.makedirs(MODEL_DIR, exist_ok=True)

    load_model()

    print()
    print(f"🌐 Starting server on http://localhost:{SERVER_PORT}")
    print(f"   Recognition threshold: {RECOGNITION_THRESHOLD}")
    print()

    app.run(host="0.0.0.0", port=SERVER_PORT, debug=False)
