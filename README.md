# AROHAN — Autonomous Safety Monitoring System

[![Status](https://img.shields.io/badge/status-production-green)]()
[![Version](https://img.shields.io/badge/version-2.0.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-orange)]()
[![CI](https://github.com/shaddy-pv/Arohan/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

> Real-time IoT safety monitoring with computer vision, face recognition, AI hazard scoring, and autonomous rover control.

**Live Demo**: [arohan-ruby.vercel.app](https://arohan-ruby.vercel.app/) &nbsp;|&nbsp;
**Demo Video**: [Watch on Drive](https://drive.google.com/file/d/1I-GsaEnuhVUpobU__CI98upZ1kNSIQ63/view?usp=sharing) &nbsp;|&nbsp;
**Dataset**: [HuggingFace](https://huggingface.co/datasets/shaddy-pv/arohan-hazard-detection-dataset)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📡 **Real-Time Monitoring** | Live sensor data from ESP32 IoT nodes (gas, smoke, temp, motion) |
| 🧠 **AI Hazard Scoring** | Multi-sensor fusion → severity classification (LOW / MEDIUM / HIGH / CRITICAL) |
| 📷 **Computer Vision** | Face detection, face recognition, and accident detection via ESP32-CAM |
| 🤖 **Autonomous Rover** | Auto-dispatched rover for on-ground visual verification |
| 🚨 **Alert System** | Automated alerts with WhatsApp + voice call notifications (Twilio) |
| 📊 **Dashboard** | Modern React mission-control panel with dark/light themes |
| 🕑 **History & Analytics** | Data logging, trend analysis, and incident timeline |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                     │
│              arohan-ruby.vercel.app                     │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   Firebase Cloud    │
          │  (Realtime DB +     │
          │   Auth + Storage)   │
          └────┬──────────┬─────┘
               │          │
    ┌──────────▼──┐  ┌────▼──────────────┐
    │  CV Backend │  │  IoT Dispatch     │
    │  (Flask +   │  │  Server           │
    │   OpenCV)   │  └────┬──────────────┘
    └─────────────┘       │
                    ┌─────▼──────────────┐
                    │  Hardware Layer    │
                    │  ESP32-CAM + Rover │
                    │  + IoT Sensors     │
                    └────────────────────┘
```

**Tech Stack**:
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Python 3.13, Flask 3.0, OpenCV 4.12, face-recognition
- **Cloud**: Firebase Realtime Database, Firebase Auth, Firebase Storage
- **AI Engine**: Python, scikit-learn, sensor fusion algorithms
- **Hardware**: ESP32-CAM, Arduino, MQ2, MQ135, DHT, Flame, PIR sensors
- **Notifications**: Twilio (WhatsApp + Voice calls)

---

## 📁 Repository Structure

```
Arohan/
├── frontend/                  → React 18 + TypeScript dashboard (Vite)
│   ├── src/
│   │   ├── components/        → 25+ reusable UI components
│   │   ├── pages/             → 12 route-level pages
│   │   ├── hooks/             → Custom React hooks
│   │   ├── services/          → Firebase & CV backend services
│   │   ├── contexts/          → Auth & Firebase contexts
│   │   └── lib/               → Utilities & Firebase config
│   └── package.json
│
├── backend/                   → Python Flask CV backend
│   ├── cv_backend.py          → Main server (face recog + hazard detection)
│   ├── iot_dispatch_server.py → IoT ↔ Firebase bridge server
│   ├── whatsapp_monitor.py    → Twilio WhatsApp alert service
│   ├── known_faces/           → Face training images (gitignored)
│   ├── trained_model/         → ML model files (gitignored)
│   └── requirements_cv.txt    → Python dependencies
│
├── functions/                 → Firebase Cloud Functions
│
├── docs/                      → Full technical documentation
│   ├── ARCHITECTURE.md        → System architecture deep-dive
│   ├── API.md                 → Backend API reference
│   ├── BACKEND.md             → Backend setup & internals
│   ├── FRONTEND.md            → Frontend guide
│   ├── DATABASE.md            → Firebase schema
│   ├── COMPONENTS.md          → UI component reference
│   ├── SETUP.md               → Full installation guide
│   └── SYSTEM_FLOW.md        → End-to-end data flow
│
├── hardware/                  → Physical hardware code
│   ├── rover/                 → Arduino rover firmware + face recog server
│   │   ├── rover_firmware.ino → Main Arduino sketch
│   │   ├── face_recognition_server.py
│   │   ├── train_faces.py
│   │   └── known_faces/       → Training images (gitignored)
│   └── esp32cam/              → ESP32-CAM firmware
│       └── esp32cam.ino       → Camera streaming firmware
│
├── ai/                        → AI engine (sensor fusion & severity scoring)
│   ├── fusion/                → Multi-sensor fusion algorithms
│   ├── severity/              → Severity classification (LOW→CRITICAL)
│   ├── prediction/            → Predictive hazard models
│   ├── recommendation/        → Response recommendation engine
│   └── requirements.txt
│
├── datasets/                  → Training & benchmark datasets
│   ├── arohan-multimodal-hazard-detection-dataset/
│   │   ├── fire_detection/    → Fire images
│   │   ├── gas_detection/     → Gas sensor data
│   │   └── air_quality/       → Air quality IoT CSV
│   └── archive/               → Raw downloaded source datasets (gitignored)
│
└── archive/                   → Legacy versions preserved for reference
    └── hackindia-2026/        → Legacy HackIndia submission preserved for reference.
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Firebase CLI — `npm install -g firebase-tools`

### 1. Clone

```bash
git clone https://github.com/shaddy-pv/Arohan.git
cd Arohan
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# Fill in your Firebase credentials in .env
npm install
npm run dev
# → http://localhost:8080
```

### 3. Backend (CV Server)

```bash
cd backend
cp .env.example .env
# Fill in your credentials in .env
pip install -r requirements_cv.txt
python start_cv_backend.py
# → http://localhost:5000
```

### 4. IoT Dispatch Server

```bash
cd backend
python iot_dispatch_server.py
```

### 5. Deploy Firebase Rules

```bash
firebase deploy --only database
```

📖 Full setup guide: [docs/SETUP.md](docs/SETUP.md)

---

## 🧪 Testing

```bash
# Frontend
cd frontend && npm test

# Backend health check
curl http://localhost:5000/health

# Frontend build check
cd frontend && npm run build
```

---

## 📦 Deployment

```bash
# Frontend → Vercel (auto-deploys on push to main)
# or manually:
cd frontend && npm run build
firebase deploy --only hosting

# Database rules
firebase deploy --only database
```

---

## 📚 Documentation

| Doc | Description |
|---|---|
| [SETUP.md](docs/SETUP.md) | Full installation & configuration guide |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture overview |
| [API.md](docs/API.md) | Backend REST API reference |
| [BACKEND.md](docs/BACKEND.md) | CV backend internals |
| [FRONTEND.md](docs/FRONTEND.md) | Frontend component guide |
| [DATABASE.md](docs/DATABASE.md) | Firebase schema & rules |
| [SYSTEM_FLOW.md](docs/SYSTEM_FLOW.md) | End-to-end data flow |
| [COMPONENTS.md](docs/COMPONENTS.md) | UI component reference |

---

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 🔐 Security

- Firebase Authentication (Email/Password)
- Firebase Database security rules
- HTTPS only in production
- All secrets via environment variables
- CORS configured on backend
- Gitleaks secret scanning on every PR

> **Found a security issue?** Open a private GitHub issue or contact the maintainers directly.

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👥 Team

**Team TECHEEZ**

- **Shadan** — Developer
- **Shivam** — Developer

---

## 🔗 Links

- 🌐 **Live Demo**: [arohan-ruby.vercel.app](https://arohan-ruby.vercel.app/)
- 🎥 **Demo Video**: [Drive](https://drive.google.com/file/d/1I-GsaEnuhVUpobU__CI98upZ1kNSIQ63/view?usp=sharing)
- 🤗 **Dataset**: [HuggingFace](https://huggingface.co/datasets/shaddy-pv/arohan-hazard-detection-dataset)
- 🔥 **Firebase Console**: [Arohan Database](https://console.firebase.google.com/project/ronin-80b29)

---

**Version**: 2.0.0 &nbsp;|&nbsp; **Status**: Production Ready &nbsp;|&nbsp; **Last Updated**: July 2026

*Made with ⚡ by Team TECHEEZ*
