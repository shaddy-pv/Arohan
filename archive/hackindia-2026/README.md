> **Legacy HackIndia submission preserved for reference.**

---

# AROHHAN — HackIndia 2026 Submission

**AI-Powered Autonomous Safety & Emergency Response Ecosystem**

This is the original prototype submitted to **HackIndia 2026** by Team TECHEEZ.  
It represents an earlier, standalone architecture of the AROHAN system built during the hackathon sprint.

> ⚠️ **This is an archive.** For the current production codebase, see the root of this repository.

---

## 📂 What's in Here

| Directory | Description |
|---|---|
| `frontend/` | React + Vite dashboard (JavaScript, simpler version) |
| `backend/` | Node.js + Express + Socket.io server |
| `ai-engine/` | Python AI engine (sensor fusion, severity scoring) |
| `hardware/` | ESP32 + Arduino wiring, schematics, component list |
| `simulations/` | JSON payloads simulating fire/gas events for testing |
| `docs/` | Architecture diagrams and notes |
| `media/` | Screenshots and demo assets |
| `pitch-deck/` | Pitch deck assets |

---

## 🏗️ Architecture (Hackathon Version)

```
Frontend (React) ←→ Backend (Node.js + Socket.io) ←→ AI Engine (Python)
                                ↕
                     Hardware (ESP32 + Sensors)
```

This differs from the production version which uses Firebase instead of a custom WebSocket backend.

---

## 🔗 Links

- **Demo Video**: https://drive.google.com/file/d/1I-GsaEnuhVUpobU__CI98upZ1kNSIQ63/view?usp=sharing
- **MVP Dashboard**: https://arohan-ruby.vercel.app/
- **Documentation**: https://drive.google.com/file/d/1O8EUNkS87W9LC7qszqtTBXuaTxcXJNmz/view?usp=sharing

---

*Built with ⚡ for HackIndia by Team TECHEEZ*
