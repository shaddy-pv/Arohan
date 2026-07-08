import { database } from './firebase';
import { ref, onValue, set, update, push, off } from 'firebase/database';

// Types based on AROHAN Firebase structure (matching firmware schema)
export interface IoTReadings {
  mq2: number; // Continuous analog reading (PPM)
  mq135: number; // Legacy field (may contain digital or analog value)
  mq135_raw: 0 | 1; // Binary threshold flag (raw reading)
  mq135_digital: 0 | 1; // Binary threshold flag (processed) - PRIMARY for hazard calc
  temperature: number;
  humidity: number;
  flame: boolean;
  motion: boolean;
  hazardScore: number;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  status: {
    online: boolean;
    lastHeartbeat: number;
  };
  emergency: {
    active: boolean;
    timestamp: number;
  };
}

export interface RoverControl {
  direction: 'forward' | 'back' | 'left' | 'right' | 'stop';
  speed: number;
  mode: 'auto' | 'manual';
  emergency: boolean;
}

export interface RoverStatus {
  battery: number;
  location: string;
  online: boolean;
  lastHeartbeat?: number;
}

export interface RoverSensors {
  mq2: number; // Continuous analog reading
  mq135: number; // Continuous analog reading (NOT binary like fixed IoT)
  temperature: number;
  humidity: number;
  timestamp: number;
}

export interface Alert {
  timestamp: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  resolved: boolean;
}

export interface HistoryLog {
  timestamp: number;
  mq2: number;
  mq135: number;
  temperature: number;
  flame: boolean;
  motion: boolean;
  hazardScore: number;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
}

// IoT Readings
export const subscribeToIoTReadings = (callback: (data: IoTReadings | null) => void) => {
  const iotRef = ref(database, 'ronin/iot');
  onValue(iotRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(iotRef);
};

// Rover Control
export const subscribeToRoverControl = (callback: (data: RoverControl | null) => void) => {
  const roverControlRef = ref(database, 'ronin/rover/control');
  onValue(roverControlRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(roverControlRef);
};

export const updateRoverControl = async (control: Partial<RoverControl>) => {
  const roverControlRef = ref(database, 'ronin/rover/control');
  await update(roverControlRef, control);
};

export const setRoverDirection = async (direction: RoverControl['direction'], speed: number = 50) => {
  await updateRoverControl({ direction, speed });
};

export const setRoverMode = async (mode: 'auto' | 'manual') => {
  await updateRoverControl(
    mode === 'manual'
      ? { mode, direction: 'stop', speed: 0, emergency: false }
      : { mode }
  );
};

export const triggerEmergencyStop = async () => {
  await updateRoverControl({ 
    direction: 'stop', 
    speed: 0, 
    emergency: true 
  });
  // Auto-reset emergency flag after 2 seconds so the bridge
  // doesn't keep seeing stale emergency=true on every poll
  setTimeout(() => {
    updateRoverControl({ emergency: false }).catch(() => {});
  }, 2000);
};

const normalizeRoverStatus = (value: unknown): RoverStatus | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    return {
      online: true,
      battery: 100,
      location: value,
      lastHeartbeat: Date.now(),
    };
  }

  if (typeof value === 'object') {
    const raw = value as Record<string, unknown>;
    return {
      battery: Number(raw.battery) || 0,
      location: String(raw.location ?? raw.state ?? 'Unknown'),
      online: Boolean(raw.online ?? true),
      lastHeartbeat: Number(raw.lastHeartbeat) || Date.now(),
    };
  }

  return null;
};

// Rover Status
export const subscribeToRoverStatus = (callback: (data: RoverStatus | null) => void) => {
  const roverStatusRef = ref(database, 'ronin/rover/status');
  onValue(roverStatusRef, (snapshot) => {
    callback(normalizeRoverStatus(snapshot.val()));
  });
  return () => off(roverStatusRef);
};

// Rover Sensors (analog readings including continuous MQ-135)
export const subscribeToRoverSensors = (callback: (data: RoverSensors | null) => void) => {
  const roverSensorsRef = ref(database, 'ronin/rover/sensors');
  onValue(roverSensorsRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(roverSensorsRef);
};

// Alerts
export const subscribeToAlerts = (callback: (data: Record<string, Alert> | null) => void) => {
  const alertsRef = ref(database, 'ronin/alerts');
  onValue(alertsRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(alertsRef);
};

export const addAlert = async (alert: Omit<Alert, 'timestamp'>) => {
  const alertsRef = ref(database, 'ronin/alerts');
  const newAlertRef = push(alertsRef);
  await set(newAlertRef, {
    ...alert,
    timestamp: Date.now()
  });
};

export const resolveAlert = async (alertId: string) => {
  const alertRef = ref(database, `ronin/alerts/${alertId}`);
  await update(alertRef, { resolved: true });
};

// History
export const subscribeToHistory = (callback: (data: Record<string, HistoryLog> | null) => void) => {
  const historyRef = ref(database, 'ronin/history');
  onValue(historyRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(historyRef);
};

export const addHistoryLog = async (log: Omit<HistoryLog, 'timestamp'>) => {
  const historyRef = ref(database, 'ronin/history');
  const newLogRef = push(historyRef);
  await set(newLogRef, {
    ...log,
    timestamp: Date.now()
  });
};

// Hazard Score Calculation (for frontend validation/display)
export const calculateHazardScore = (
  mq135: number,
  mq2: number,
  temperature: number,
  ranges: {
    mq135: { min: number; max: number };
    mq2: { min: number; max: number };
    temp: { min: number; max: number };
  }
): number => {
  const normalize = (value: number, min: number, max: number): number => {
    return Math.max(0, Math.min(100, (100 * (value - min)) / (max - min)));
  };

  const normMQ135 = normalize(mq135, ranges.mq135.min, ranges.mq135.max);
  const normMQ2 = normalize(mq2, ranges.mq2.min, ranges.mq2.max);
  const normTemp = normalize(temperature, ranges.temp.min, ranges.temp.max);

  return 0.6 * normMQ135 + 0.3 * normMQ2 + 0.1 * normTemp;
};

export const getRiskLevel = (hazardScore: number): 'SAFE' | 'WARNING' | 'DANGER' => {
  if (hazardScore < 30) return 'SAFE';
  if (hazardScore < 60) return 'WARNING';
  return 'DANGER';
};

export interface WhatsAppSettings {
  enabled: boolean;
  recipientNumber: string;
  minSeverity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SystemSettings {
  thresholds: {
    safeMax: number;
    warningMax: number;
    dangerMin: number;
  };
  sensorRanges: {
    mq135: { min: number; max: number };
    mq2: { min: number; max: number };
    temp: { min: number; max: number };
  };
  roverBehavior: {
    autoDispatchEnabled: boolean;
    autoDispatchThreshold: number;
    returnToBaseAfterCheck: boolean;
    checkDuration: number; // seconds
  };
  whatsappNotifications?: WhatsAppSettings;
}

export const subscribeToSettings = (callback: (data: SystemSettings | null) => void) => {
  const settingsRef = ref(database, 'ronin/settings');
  onValue(settingsRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(settingsRef);
};

export const updateSettings = async (settings: Partial<SystemSettings>) => {
  const settingsRef = ref(database, 'ronin/settings');
  await update(settingsRef, settings);
};

export const updateThresholds = async (thresholds: Partial<SystemSettings['thresholds']>) => {
  const thresholdsRef = ref(database, 'ronin/settings/thresholds');
  await update(thresholdsRef, thresholds);
};

export const updateRoverBehavior = async (behavior: Partial<SystemSettings['roverBehavior']>) => {
  const behaviorRef = ref(database, 'ronin/settings/roverBehavior');
  await update(behaviorRef, behavior);
};

// WhatsApp Notification Settings
export const updateWhatsAppSettings = async (whatsappSettings: Partial<WhatsAppSettings>) => {
  const whatsappRef = ref(database, 'ronin/settings/whatsappNotifications');
  await update(whatsappRef, whatsappSettings);
};

export const subscribeToWhatsAppLogs = (callback: (data: Record<string, any> | null) => void) => {
  const logsRef = ref(database, 'ronin/whatsapp_logs');
  onValue(logsRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(logsRef);
};

