"""
=================================================================
 AROHAN Rover — Face Recognition Training Script
 
 Uses OpenCV's DNN face detector + a histogram-based face
 encoding approach. Does NOT depend on dlib.

 Usage:
   python train_faces.py

 Dataset structure:
   dataset/
   ├── Shivam/
   │   ├── img1.jpg
   │   ├── img2.jpg
   │   └── img3.jpg
   └── Aarav/
       ├── photo1.png
       └── photo2.jpg
=================================================================
"""

import os
import sys
import pickle
import time
import cv2
import numpy as np
from PIL import Image

# ── PATHS ──────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(SCRIPT_DIR, "dataset")
MODEL_DIR = os.path.join(SCRIPT_DIR, "trained_model")
ENCODINGS_FILE = os.path.join(MODEL_DIR, "encodings.pkl")

# Supported image extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# ── OPENCV DNN FACE DETECTOR ──────────────────────────────────────
# Uses OpenCV's built-in DNN face detector (no dlib needed!)
FACE_DETECTOR = None


def get_face_detector():
    """Get or create OpenCV DNN face detector."""
    global FACE_DETECTOR
    if FACE_DETECTOR is None:
        # Use OpenCV's built-in Haar Cascade (always available, no downloads)
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        FACE_DETECTOR = cv2.CascadeClassifier(cascade_path)
        if FACE_DETECTOR.empty():
            print("❌ Failed to load face cascade classifier!")
            sys.exit(1)
    return FACE_DETECTOR


def detect_faces(image):
    """Detect faces in an image using OpenCV. Returns list of (x, y, w, h)."""
    detector = get_face_detector()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    
    faces = detector.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(60, 60),
        flags=cv2.CASCADE_SCALE_IMAGE
    )
    
    return faces


def compute_face_encoding(image, face_rect):
    """
    Compute a face encoding using LBP histogram + color histogram.
    This is a lightweight but effective approach that doesn't need dlib.
    Returns a normalized feature vector.
    """
    x, y, w, h = face_rect
    
    # Extract face region with some padding
    pad = int(0.1 * max(w, h))
    y1 = max(0, y - pad)
    y2 = min(image.shape[0], y + h + pad)
    x1 = max(0, x - pad)
    x2 = min(image.shape[1], x + w + pad)
    
    face_roi = image[y1:y2, x1:x2]
    
    # Resize to standard size for consistent features
    face_resized = cv2.resize(face_roi, (128, 128))
    
    features = []
    
    # 1. LBP (Local Binary Pattern) histogram — captures texture
    gray_face = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY)
    # Compute LBP manually
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
    
    # Split into 4x4 grid and compute histogram per cell
    cell_h, cell_w = lbp.shape[0] // 4, lbp.shape[1] // 4
    for ci in range(4):
        for cj in range(4):
            cell = lbp[ci*cell_h:(ci+1)*cell_h, cj*cell_w:(cj+1)*cell_w]
            hist, _ = np.histogram(cell, bins=32, range=(0, 256))
            hist = hist.astype(np.float64)
            hist_sum = hist.sum()
            if hist_sum > 0:
                hist /= hist_sum
            features.extend(hist)
    
    # 2. Color histogram (HSV) — captures skin tone / color
    hsv_face = cv2.cvtColor(face_resized, cv2.COLOR_BGR2HSV)
    for ch in range(3):
        hist = cv2.calcHist([hsv_face], [ch], None, [32], [0, 256])
        hist = hist.flatten().astype(np.float64)
        hist_sum = hist.sum()
        if hist_sum > 0:
            hist /= hist_sum
        features.extend(hist)
    
    # 3. HOG-like gradient features
    gx = cv2.Sobel(gray_face, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray_face, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(gx**2 + gy**2)
    angle = np.arctan2(gy, gx) * 180 / np.pi + 180
    
    # 4x4 cells, 9 orientation bins
    for ci in range(4):
        for cj in range(4):
            cell_mag = magnitude[ci*cell_h:(ci+1)*cell_h, cj*cell_w:(cj+1)*cell_w]
            cell_ang = angle[ci*cell_h:(ci+1)*cell_h, cj*cell_w:(cj+1)*cell_w]
            hist, _ = np.histogram(cell_ang, bins=9, range=(0, 360), weights=cell_mag)
            hist = hist.astype(np.float64)
            hist_sum = hist.sum()
            if hist_sum > 0:
                hist /= hist_sum
            features.extend(hist)
    
    # Convert to numpy array and L2-normalize
    encoding = np.array(features, dtype=np.float64)
    norm = np.linalg.norm(encoding)
    if norm > 0:
        encoding /= norm
    
    return encoding


def print_banner():
    print("=" * 60)
    print("  🤖 AROHAN Face Recognition — Training Script")
    print("  📦 Using OpenCV (no dlib dependency)")
    print("=" * 60)


def scan_dataset():
    """Scan the dataset directory and return a dict of {name: [image_paths]}."""
    if not os.path.isdir(DATASET_DIR):
        print(f"\n❌ Dataset directory not found: {DATASET_DIR}")
        print("   Create it and add person folders with face images.")
        sys.exit(1)

    people = {}
    for person_name in sorted(os.listdir(DATASET_DIR)):
        person_dir = os.path.join(DATASET_DIR, person_name)
        if not os.path.isdir(person_dir):
            continue
        if person_name.startswith("."):
            continue

        images = []
        for fname in sorted(os.listdir(person_dir)):
            ext = os.path.splitext(fname)[1].lower()
            if ext in IMAGE_EXTENSIONS:
                images.append(os.path.join(person_dir, fname))

        if images:
            people[person_name] = images

    return people


def train(people):
    """Encode all faces and return (names, encodings) lists."""
    all_names = []
    all_encodings = []
    total_images = sum(len(imgs) for imgs in people.values())
    processed = 0

    print(f"\n📁 Found {len(people)} people, {total_images} images total.\n")

    for person_name, image_paths in people.items():
        person_encodings = 0
        print(f"  👤 {person_name} ({len(image_paths)} images)")

        for img_path in image_paths:
            processed += 1
            fname = os.path.basename(img_path)

            # Load image with PIL then convert to OpenCV format
            try:
                pil_image = Image.open(img_path).convert("RGB")
                image = cv2.cvtColor(np.array(pil_image, dtype=np.uint8), cv2.COLOR_RGB2BGR)
            except Exception as load_err:
                print(f"     ⚠️  Could not read: {fname} ({load_err})")
                continue

            if image is None or image.size == 0:
                print(f"     ⚠️  Empty image: {fname}")
                continue

            # Detect faces
            faces = detect_faces(image)

            if len(faces) == 0:
                print(f"     ⚠️  No face detected in: {fname}")
                continue

            if len(faces) > 1:
                print(f"     ℹ️  Multiple faces in {fname}, using largest.")
                faces = [max(faces, key=lambda f: f[2] * f[3])]

            # Compute face encoding
            face_rect = tuple(faces[0])
            encoding = compute_face_encoding(image, face_rect)

            all_names.append(person_name)
            all_encodings.append(encoding)
            person_encodings += 1
            progress = f"[{processed}/{total_images}]"
            print(f"     ✅ {progress} Encoded: {fname}")

        if person_encodings == 0:
            print(f"     ❌ No encodings generated for {person_name}!")
        print()

    return all_names, all_encodings


def save_model(names, encodings):
    """Save encodings to pickle file."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    data = {
        "names": names,
        "encodings": encodings,
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "num_people": len(set(names)),
        "num_encodings": len(encodings),
    }

    with open(ENCODINGS_FILE, "wb") as f:
        pickle.dump(data, f)

    print(f"💾 Model saved to: {ENCODINGS_FILE}")
    print(f"   Encoding dimensions: {len(encodings[0])}")
    print(f"   Total encodings: {len(encodings)}")
    print(f"   Unique people:   {len(set(names))}")
    print(f"   People: {', '.join(sorted(set(names)))}")


def main():
    print_banner()

    # Scan dataset
    print("\n🔍 Scanning dataset directory...")
    people = scan_dataset()

    if not people:
        print("\n❌ No people with images found in dataset/")
        print("   Add folders with face images:")
        print(f"   {DATASET_DIR}/<PersonName>/image.jpg")
        sys.exit(1)

    # Train
    print("\n🧠 Training face encodings (this may take a moment)...\n")
    start_time = time.time()
    names, encodings = train(people)
    elapsed = time.time() - start_time

    if not encodings:
        print("\n❌ No face encodings were generated!")
        print("   Make sure your images contain clear, front-facing faces.")
        sys.exit(1)

    # Save
    print(f"\n⏱️  Training completed in {elapsed:.1f} seconds.\n")
    save_model(names, encodings)

    print("\n" + "=" * 60)
    print("  ✅ Training complete! You can now run:")
    print("     python face_recognition_server.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
