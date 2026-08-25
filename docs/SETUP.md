# Setup Guide

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Python 3.10+** - [Download](https://www.python.org/)
- **Git** - [Download](https://git-scm.com/)
- **Firebase Account** - [Sign up](https://firebase.google.com/) (free)
- **Groq Account** - [Sign up](https://console.groq.com/) (free)

## Step 1: Clone Repository

```bash
git clone <repository-url>
cd Arohan
```

## Step 2: Firebase Setup

### 2.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `ronin` (or your choice)
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2.2 Enable Realtime Database
1. In Firebase Console, go to "Realtime Database"
2. Click "Create Database"
3. Choose location (closest to you)
4. Start in "Test mode" (we'll add rules later)
5. Click "Enable"

### 2.3 Get Firebase Config
1. Go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click "Web" icon (</>) to add web app
4. Register app with nickname: `AROHAN Frontend`
5. Copy the `firebaseConfig` object

### 2.4 Download Service Account Key (for backend)
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save as `backend/firebase-credentials.json`

### 2.5 Deploy Security Rules
```bash
firebase login
firebase init database
# Select your project
# Use database.rules.json
firebase deploy --only database
```

## Step 3: Groq API Setup

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up / Log in
3. Go to API Keys section
4. Click "Create API Key"
5. Copy the key (starts with `gsk_`)

## Step 4: Frontend Setup

```bash
cd frontend
npm install
```

### 4.1 Create .env File
```bash
cp .env.example .env
```

### 4.2 Edit .env
```bash
# Firebase Configuration (from Step 2.3)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# ESP32-CAM (update with your ESP32 IP)
VITE_ESP32_BASE_URL=http://192.168.1.22

# CV Backend
VITE_CV_BACKEND_URL=http://localhost:5000

# Groq AI (from Step 3)
VITE_GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 4.3 Start Frontend
```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

## Step 5: Backend Setup

```bash
cd backend
pip install -r requirements_cv.txt
```

### 5.1 Install face_recognition (Optional)
```bash
# Install cmake first
pip install cmake

# Install dlib
pip install dlib

# Install face_recognition
pip install face_recognition
```

**Note**: If this fails, backend will auto-fall back to LBP+HOG (no dlib required)

### 5.2 Create .env File
```bash
# ESP32-CAM
ESP32_CAM_URL=http://192.168.1.22:81

# Backend
BACKEND_URL=http://localhost:5000
PORT=5000

# Face Recognition
FR_DISTANCE_THRESHOLD=0.55
CONFIDENCE_THRESHOLD=0.38
BLUR_THRESHOLD=8.0
FACE_DETECTOR_MODE=dnn

# Limits
MAX_ALERTS=1000
MAX_SNAPSHOTS=200

# Firebase
FIREBASE_CREDENTIALS=firebase-credentials.json
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
```

### 5.3 Add Training Images
```bash
mkdir -p known_faces/person_name
# Add 3-5 images per person
# Example:
# known_faces/shadan/photo1.jpg
# known_faces/shadan/photo2.jpg
# known_faces/shivam/photo1.jpg
```

### 5.4 Start Backend
```bash
python cv_backend.py
```

Backend will be available at `http://localhost:5000`


## Step 6: ESP32-CAM Setup (Optional)

### 6.1 Install Arduino IDE
1. Download [Arduino IDE](https://www.arduino.cc/en/software)
2. Install ESP32 board support:
   - File → Preferences
   - Additional Board Manager URLs: `https://dl.espressif.com/dl/package_esp32_index.json`
   - Tools → Board → Boards Manager
   - Search "ESP32" and install

### 6.2 Flash Camera Code
1. Open `AROHAN_Rover_FINAL/esp32cam/esp32cam.ino`
2. Update WiFi credentials:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Select board: "AI Thinker ESP32-CAM"
4. Select port (USB-to-Serial adapter)
5. Upload code
6. Open Serial Monitor (115200 baud)
7. Note the IP address printed

### 6.3 Update Frontend .env
```bash
VITE_ESP32_BASE_URL=http://192.168.1.XX  # Use IP from Serial Monitor
```

### 6.4 Test ESP32
```bash
# Test capture endpoint
curl http://192.168.1.XX:81/capture --output test.jpg

# Test stream endpoint
# Open in browser: http://192.168.1.XX:81/stream
```

## Step 7: IoT Sensor Setup (Optional)

### 7.1 Hardware Connections
```
ESP32/Arduino:
- MQ-2 → A0 (analog)
- MQ-135 → A1 (analog) + D2 (digital)
- DHT11 → D3 (data)
- Flame → D4 (digital)
- PIR → D5 (digital)
- Ultrasonic Trig → D6
- Ultrasonic Echo → D7
```

### 7.2 Install Firebase ESP32 Library
1. Arduino IDE → Library Manager
2. Search "Firebase ESP32"
3. Install "Firebase Arduino Client Library for ESP8266 and ESP32"

### 7.3 Flash IoT Code
1. Open IoT node sketch
2. Update WiFi and Firebase credentials
3. Upload to ESP32/Arduino
4. Monitor Serial output for connection status

## Step 8: Verify Everything Works

### Checklist

- [ ] Frontend loads at `http://localhost:5173`
- [ ] CV Backend responds at `http://localhost:5000/health`
- [ ] ESP32 stream visible at `http://192.168.1.XX:81/stream`
- [ ] Firebase data appearing in Dashboard
- [ ] Face recognition working (if training images added)
- [ ] Groq AI analysis working (Solution page)
- [ ] Rover control commands sent to Firebase
- [ ] IoT sensor data updating in real-time

### Test Commands

```bash
# Test CV Backend
curl http://localhost:5000/health

# Test ESP32
curl http://192.168.1.XX:81/capture --output test.jpg

# Test Firebase (requires auth)
# Use Firebase Console → Realtime Database to view data

# Test Groq API
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $VITE_GROQ_API_KEY"
```

## Troubleshooting

### Frontend Issues

**Issue**: `npm install` fails  
**Solution**: Update Node.js to 18+, clear npm cache: `npm cache clean --force`

**Issue**: Firebase connection error  
**Solution**: Check .env file, verify Firebase config, check internet connection

**Issue**: Blank dashboard  
**Solution**: Check Firebase security rules, verify authentication, check browser console

### Backend Issues

**Issue**: `pip install face_recognition` fails  
**Solution**: Install cmake and dlib first, or use LBP+HOG fallback (no action needed)

**Issue**: ESP32 not connecting  
**Solution**: Check IP address, verify ESP32 is on same network, ping ESP32

**Issue**: No faces detected  
**Solution**: Check lighting, add training images, adjust `BLUR_THRESHOLD`

**Issue**: Wrong person recognized  
**Solution**: Add more training images (3-5 per person), retrain model

### ESP32 Issues

**Issue**: Upload fails  
**Solution**: Press BOOT button during upload, check USB connection, verify board selection

**Issue**: No IP address  
**Solution**: Check WiFi credentials, verify router allows ESP32, check Serial Monitor

**Issue**: Stream not loading  
**Solution**: Reduce resolution, check power supply (5V 2A minimum), restart ESP32

### Firebase Issues

**Issue**: Permission denied  
**Solution**: Deploy security rules, verify authentication, check user permissions

**Issue**: Data not updating  
**Solution**: Check internet connection, verify Firebase URL, check browser console

## Production Deployment

### Frontend (Firebase Hosting)

```bash
cd frontend
npm run build
firebase init hosting
# Select your project
# Public directory: dist
# Single-page app: Yes
# Overwrite index.html: No
firebase deploy --only hosting
```

### Backend (VPS/Cloud)

1. Choose hosting provider (AWS, GCP, DigitalOcean, etc.)
2. Install Python 3.10+
3. Clone repository
4. Install dependencies: `pip install -r requirements_cv.txt`
5. Configure .env with production values
6. Use process manager (PM2, systemd, supervisor)
7. Configure reverse proxy (nginx, Apache)
8. Enable HTTPS (Let's Encrypt)

### Example systemd Service

```ini
[Unit]
Description=AROHAN CV Backend
After=network.target

[Service]
Type=simple
User=arohan
WorkingDirectory=/home/arohan/Arohan/backend
Environment="PATH=/home/arohan/venv/bin"
ExecStart=/home/arohan/venv/bin/python cv_backend.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## Next Steps

1. Add more training images for better face recognition
2. Configure alert thresholds in Settings page
3. Set up auto-dispatch for high hazard scores
4. Create saved paths for rover navigation
5. Export historical data for analysis
6. Customize hazard score calculation weights

---

**Next**: [Component Reference](./COMPONENTS.md)
