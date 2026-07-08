# AI Engine

The Intelligence Layer of AROHHAN.

## Overview
This module processes real-time sensor streams and calculates hazard severity using multi-modal sensor fusion. By correlating data points (e.g., Temperature + Smoke + Motion), it eliminates false positives and provides actionable intelligence to the central backend.

## Modules

### 1. Sensor Fusion (`fusion/sensor_fusion.py`)
Aggregates heterogeneous data sources and applies weighted algorithms to generate a base risk score (0-100).

### 2. Severity Scoring (`severity/severity_scoring.py`)
Classifies the risk score into standard operational levels:
- **LOW:** Safe conditions.
- **MEDIUM:** Minor anomaly, monitor closely.
- **HIGH:** Imminent hazard, dispatch rover for visual verification.
- **CRITICAL:** Immediate danger, sound alarms, initiate evacuation protocols.

## Setup
```bash
pip install -r requirements.txt
# (To be integrated via REST API/MQTT in production)
```
