<div align="center">

# 🚀 AROHAN
**An Autonomous Safety AI Agent for Real-Time Hazard Detection, Verification & Incident Response**

[![Hackathon](https://img.shields.io/badge/Hackathon-HackIndia_AI_Agents_2026-blueviolet?style=for-the-badge)](https://hackindia.xyz)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

*A futuristic Detect → Verify → Secure → Respond ecosystem powered by AI, IoT, and Blockchain.*

[Demo Video](https://drive.google.com/file/d/1I-GsaEnuhVUpobU__CI98upZ1kNSIQ63/view?usp=sharing) • [MVP Dashboard](https://arohan-ruby.vercel.app/)

</div>

---

## 📖 Project Overview

**AROHAN** is an autonomous safety AI agent designed to detect, verify, and respond to hazardous incidents in real time across campuses, laboratories, industries, and workplaces.

Unlike traditional safety systems that rely heavily on delayed human intervention, AROHAN combines **IoT sensors, AI-driven decision making, autonomous rover verification, and blockchain-backed trust mechanisms** to create an intelligent end-to-end incident response ecosystem.

The system continuously monitors environmental conditions using fixed IoT sensor nodes, analyzes risk using AI models, dispatches an autonomous rover for live verification, validates incidents using blockchain smart contracts, and executes mitigation measures automatically.

---

## 🚨 Problem Statement

Current safety systems are reactive, isolated, and dependent on manual verification. Delays of even a few minutes during incidents such as gas leaks, fires, chemical spills, or unauthorized access can escalate into catastrophic events. There is a critical need for an intelligent autonomous system capable of **Detect → Verify → Secure → Respond** workflows in real time.

---

## 💡 Why AROHAN?

- **Zero-Delay Verification**: Traditional alarms require human verification. AROHAN dispatches an autonomous rover immediately for live visual confirmation.
- **Tamper-Proof Logging**: Critical incident data and mitigation logs are stored on the blockchain, creating an immutable audit trail for compliance and investigations.
- **Intelligent Response**: AI models don't just alert; they predict hazard severity and autonomously trigger facility lockdown or evacuation protocols.
- **Reduced False Positives**: Multi-sensor fusion algorithms cross-validate data points before initiating emergency workflows.

---

## ✨ Key Features

- 📡 **Real-time hazard detection** using a distributed network of IoT sensors.
- 🧠 **AI-powered risk analysis** and predictive decision making.
- 🔄 **Multi-sensor fusion** for reducing false alarms and improving accuracy.
- 🤖 **Autonomous rover navigation** and physical hazard verification.
- 🎥 **Live video streaming** directly from the incident response rover.
- ⛓️ **Blockchain validation** and immutable audit trails via smart contracts.
- 📜 **Smart contract-based incident logging** for transparent record-keeping.
- ⚡ **Automated mitigation workflows** (e.g., auto-lockdowns, ventilation triggers).
- 📱 **Mobile and dashboard alerts** for rapid stakeholder notification.
- 🛑 **Manual override support** for human-in-the-loop safety control.
- 🏗️ **Scalable and modular architecture** suitable for both small labs and large industrial complexes.

---

## 🏗️ System Architecture Overview

The AROHAN architecture is broken down into four primary layers:
1. **Perception (Hardware)**: IoT nodes continuously stream environmental data (gas, temperature, flame, motion).
2. **Intelligence (AI Engine)**: Edge/Cloud AI models classify risk and fuse sensor inputs.
3. **Execution (Robotics & Backend)**: Rovers navigate to the site; backend handles business logic.
4. **Validation (Blockchain)**: Smart contracts permanently record the verified incident.

---

## 🔄 End-to-End Workflow

Our operational workflow follows a strict 4-step protocol:

1. **Detect**: Stationary IoT sensors identify an anomaly (e.g., gas leak, rapid temperature spike).
2. **Verify**: The AI engine flags the anomaly and dispatches the autonomous rover to the precise location for visual and secondary sensor verification.
3. **Secure**: Upon verification, smart contracts log the event on the blockchain to ensure data integrity and trigger immediate automated safety protocols.
4. **Respond**: Automated systems activate (ventilation, alarms, door locks) while real-time alerts and a live video feed are sent to the emergency response dashboard and mobile apps.

---

## 🛠️ Technology Stack

| Category | Technologies |
| :--- | :--- |
| **Hardware** | ESP32, Arduino Uno, Raspberry Pi 4B, MPU6050, BMP280/BME280 |
| **Sensors** | MQ-2 Gas, MQ-135 Air Quality, DHT22 Temp, Flame, Ultrasonic |
| **AI & Analytics** | TensorFlow Lite, OpenCV, Multi-Sensor Fusion, Hazard Score Model |
| **Software Frontend** | React, React Native, TypeScript |
| **Software Backend** | Node.js, REST APIs, MongoDB |
| **Web3 & Blockchain**| Solidity, Ethers.js, Polygon, Ethereum |
| **Communication** | MQTT, HTTP/HTTPS, Wi-Fi |

---

## ⚙️ Installation & Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Arduino IDE (for hardware deployment)
- MongoDB running locally or via Atlas

### 1. Clone the Repository
```bash
git clone https://github.com/HackIndiaXYZ/AROHAN-GIT.git
cd AROHAN-GIT
```

### 2. Running the Project Locally

**Backend Setup:**
```bash
cd backend
npm install
# Configure your .env file
npm run dev
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

**AI Engine Setup:**
```bash
cd ai-engine
pip install -r requirements.txt
python main.py
```

---

## 🔧 Hardware Setup Instructions

1. Connect the **ESP32** and **Arduino Uno** to your local machine via USB.
2. Open the `hardware/firmware.ino` sketch in the **Arduino IDE**.
3. Update the Wi-Fi credentials and MQTT broker details within the sketch.
4. Flash the firmware to the ESP32/Arduino boards.
5. Connect the sensors (MQ-2, MQ-135, DHT22, Flame, Ultrasonic, MPU6050, BMP280) according to the pinout diagrams provided in the `hardware/docs/` folder.
6. Power on the **Raspberry Pi 4B** to act as the local MQTT broker and edge AI processing node.

---

## 🔐 Environment Variables Section

Create a `.env` file in the root of your `backend` and `frontend` directories using the provided `.env.example` as a template.

**Backend `.env`:**
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
MQTT_BROKER_URL=mqtt://your_broker_ip:1883
WEB3_PROVIDER_URL=https://polygon-mumbai.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=your_deployed_contract_address
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
```

---

## ⛓️ Blockchain Integration Details

AROHAN uses **Polygon/Ethereum** smart contracts written in **Solidity** to ensure maximum transparency.
- **Ethers.js** connects the Node.js backend to the blockchain network.
- When the rover verifies an incident, an immutable log is pushed to the smart contract.
- This creates a **Tamper-Proof Incident Record** accessible by insurance companies, regulatory bodies, and safety auditors, guaranteeing that sensor data and response times cannot be manipulated post-incident.

---

## 🎥 Demo Video Section

Watch our full end-to-end demonstration showcasing hazard detection, AI analysis, rover deployment, and blockchain logging.

▶️ **[Watch the AROHAN Demo Video](https://drive.google.com/file/d/1I-GsaEnuhVUpobU__CI98upZ1kNSIQ63/view?usp=sharing)**

---

## 🌐 MVP Link Section

Explore our live mission control dashboard and interact with the AI agent.

🔗 **[Access the AROHAN MVP Dashboard](https://arohan-ruby.vercel.app/)**

---

## 🔮 Future Scope

- 🚁 **Autonomous Drone Integration**: Aerial support for outdoor industrial complexes and rapid hazard mapping.
- 🔥 **Predictive Spread Modeling**: Using thermal fluid dynamics AI models to forecast fire or chemical spread within a facility.
- 🚒 **Smart City API Integration**: Direct, automated integration with municipal emergency services (Fire, Police, Ambulance) upon critical incident verification.

---

## 👥 Team Information

**Team Name:** Techeez  
**Institution:** United College of Engineering and Research, Prayagraj  

**Team Members:**
- **Md Shadan Siddiqui**
- **Shivam Kushwaha**
- **Isha Kumari**

---

## 🙏 Acknowledgements

- **HackIndia 2026 Organizers** for the incredible platform and opportunity.
- **Polygon & Web3 Ecosystem** for providing robust decentralized infrastructure.
- **Open Source Community** (React, Node, TensorFlow, OpenCV) for the tools that made this possible.

---

## 📄 License Section

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <br>
  <b>Built with ⚡ & 🤖 for the HackIndia AI Agents Hackathon 2026</b>
</div>
