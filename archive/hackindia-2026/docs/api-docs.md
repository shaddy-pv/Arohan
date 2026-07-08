# API Documentation

## Base URL
`http://localhost:5000/api`

## Endpoints

### 1. Sensors
#### `POST /sensors/data`
Receives new data from hardware nodes.
- **Payload:**
  ```json
  {
    "nodeId": "ESP-ZoneA",
    "temperature": 45.2,
    "gasLevel": 320,
    "smokeDetected": false,
    "motion": true
  }
  ```
- **Response:** `200 OK`

#### `GET /sensors/status`
Returns the latest status of all connected sensor nodes.

### 2. Hazards
#### `GET /hazards/active`
Returns a list of currently active hazard events.

#### `POST /hazards/resolve/:id`
Marks a hazard as resolved (requires admin auth).

### 3. Rover Control
#### `POST /rover/dispatch`
Commands the rover to move to a specific sector.
- **Payload:**
  ```json
  {
    "sectorId": "Sector-4",
    "priority": "HIGH"
  }
  ```

### 4. WebSocket Events
- **`sensor_update`**: Emitted by server when new sensor data arrives.
- **`hazard_alert`**: Emitted by server when AI engine flags an anomaly.
- **`rover_status`**: Emitted by server with rover's current GPS/Grid location and battery.
