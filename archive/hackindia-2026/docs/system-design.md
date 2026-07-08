# System Architecture

The AROHHAN ecosystem is built on a scalable, modular architecture integrating IoT hardware, edge AI, a centralized backend, and a real-time React dashboard.

## 1. High-Level Architecture

The system consists of 4 main layers:
- **Perception Layer (Hardware):** Captures physical world data via sensors.
- **Intelligence Layer (AI Engine):** Processes raw data, applies sensor fusion, and predicts hazard severity.
- **Control Layer (Backend):** Manages data routing, emergency state logic, and API endpoints.
- **Presentation Layer (Frontend):** Visualizes the environment state and allows human override control.

## 2. Component Details

### 2.1 Hardware Node (ESP32)
- Sensors: MQ-2 (Gas), DHT11 (Temp/Humidity), Flame Sensor, PIR (Motion)
- Communication: Connects via Wi-Fi and sends data over MQTT/HTTP to the backend.

### 2.2 Node.js Backend Server
- Framework: Express.js for REST APIs.
- Real-time: Socket.io for duplex communication with the frontend dashboard.
- Job: Stores sensor logs, triggers the AI engine when anomalies are detected, and broadcasts state changes to connected clients.

### 2.3 Python AI Engine
- Exposes an API (or acts as a message consumer).
- Receives multi-sensor data points.
- Uses `sensor_fusion.py` to calculate a holistic risk score.
- Output: Risk levels (Safe, Warning, High, Critical) + recommended action (e.g., Dispatch Rover, Sound Alarms).

### 2.4 React Dashboard
- Real-time charting of sensor data.
- 2D Map representation of the monitored area and rover location.
- Emergency override switches.

## 3. Data Flow
1. ESP32 -> HTTP POST -> Backend API
2. Backend API -> Sends data to Python AI Engine
3. Python AI Engine -> Returns Severity Score
4. Backend API -> Saves to DB & Emits via Socket.io
5. React Dashboard -> Updates UI & Charts
