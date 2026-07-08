import numpy as np

def fuse_sensor_data(temp, gas, motion, smoke):
    """
    Simulates sensor fusion logic.
    Instead of relying on a single sensor, we correlate data to avoid false positives.
    """
    risk_score = 0
    
    # Base normalization (0-100 scale)
    temp_norm = min(max((temp - 25) / 50, 0), 1) * 100
    gas_norm = min(gas / 1000, 1) * 100
    
    # Weighted fusion
    # High temp + Smoke = Fire Probability
    if temp > 45 and smoke:
        risk_score += 60
    
    # Gas leak + Motion = Human at risk
    if gas > 300 and motion:
        risk_score += 50
        
    if gas > 500:
        risk_score += 80
        
    return min(risk_score, 100)
