# AI Engine

This is the intelligence layer of AROHAN — responsible for sensor fusion, hazard severity classification, and response recommendations.

---

## 📂 Structure

```
ai/
├── fusion/             → Sensor fusion algorithms
├── severity/           → Hazard severity scoring (LOW / MEDIUM / HIGH / CRITICAL)
├── prediction/         → Predictive hazard models
├── recommendation/     → Response recommendation engine
├── models/             → Model artifacts (gitignored)
└── requirements.txt    → Python dependencies
```

---

## 🧠 How It Works

The AI engine processes multi-modal sensor streams in a pipeline:

```
IoT Sensors (Temp, Gas, Smoke, Motion)
        ↓
  Sensor Fusion  →  Base risk score (0–100)
        ↓
  Severity Scoring  →  LOW / MEDIUM / HIGH / CRITICAL
        ↓
  Recommendation  →  Monitor / Dispatch Rover / Evacuate / Lockdown
```

### 1. Sensor Fusion (`fusion/`)
Aggregates heterogeneous sensor data and applies weighted correlation algorithms to produce a single unified risk score (0–100).  
Correlating multiple sensors (e.g. Temperature + Smoke + Motion) reduces false positives.

### 2. Severity Scoring (`severity/`)

| Score | Level | Action |
|---|---|---|
| 0–24 | 🟢 LOW | Normal — monitor only |
| 25–49 | 🟡 MEDIUM | Anomaly — alert operator |
| 50–74 | 🟠 HIGH | Hazard — dispatch rover for visual verification |
| 75–100 | 🔴 CRITICAL | Immediate danger — sound alarm, initiate evacuation |

### 3. Prediction (`prediction/`)
Forecasts hazard escalation using historical sensor trends.

### 4. Recommendation (`recommendation/`)
Outputs structured response actions consumed by the backend.

---

## 🚀 Setup

```bash
cd ai
pip install -r requirements.txt

# Run mock inference (for testing)
python mock_inference.py
```

> **Integration**: The AI engine communicates with the backend via REST API / MQTT in production.  
> See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for integration details.

---

## 📦 Dependencies

- Python 3.10+
- scikit-learn
- pandas
- numpy

Install with: `pip install -r requirements.txt`
