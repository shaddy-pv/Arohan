from ..fusion.sensor_fusion import fuse_sensor_data

def classify_severity(risk_score):
    """
    Classifies risk score into actionable severity levels.
    """
    if risk_score >= 80:
        return "CRITICAL"
    elif risk_score >= 50:
        return "HIGH"
    elif risk_score >= 20:
        return "MEDIUM"
    else:
        return "LOW"

def evaluate_node(temp, gas, motion, smoke):
    score = fuse_sensor_data(temp, gas, motion, smoke)
    severity = classify_severity(score)
    return {
        "risk_score": score,
        "severity": severity,
        "requires_rover": severity in ["HIGH", "CRITICAL"],
        "requires_evacuation": severity == "CRITICAL"
    }
