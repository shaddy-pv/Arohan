import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { 
  IoTReadings, 
  RoverControl, 
  RoverStatus, 
  Alert,
  HistoryLog,
  SystemSettings,
  updateRoverControl,
  setRoverDirection,
  setRoverMode,
  triggerEmergencyStop,
  updateSettings,
  updateThresholds,
  updateRoverBehavior,
  addAlert,
  resolveAlert
} from '@/lib/firebaseService';
import { useIoTReadings } from '@/hooks/useIoTReadings';
import { useHazardScore } from '@/hooks/useHazardScore';
import { useCalculatedHazardScore, HazardScoreComparison } from '@/hooks/useCalculatedHazardScore';
import { useRover } from '@/hooks/useRover';
import { useAlerts } from '@/hooks/useAlerts';
import { useHistory } from '@/hooks/useHistory';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface FirebaseContextType {
  // IoT Data
  iotReadings: IoTReadings | null;
  iotLoading: boolean;
  iotError: Error | null;

  // Hazard Score (Device-reported)
  hazardScore: number;
  riskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  hazardLoading: boolean;
  hazardError: Error | null;

  // Calculated Hazard Score (Mathematical Model)
  calculatedHazardScore: number;
  calculatedRiskLevel: 'SAFE' | 'WARNING' | 'DANGER';
  hazardComparison: HazardScoreComparison | null;
  divergenceThreshold: number;

  // Rover
  roverControl: RoverControl | null;
  roverStatus: RoverStatus | null;
  roverLoading: boolean;
  setRoverDirection: (direction: RoverControl['direction'], speed?: number) => Promise<void>;
  setRoverMode: (mode: 'auto' | 'manual') => Promise<void>;
  updateRoverControl: (control: Partial<RoverControl>) => Promise<void>;
  triggerEmergency: () => Promise<void>;

  // Alerts
  alerts: Array<Alert & { id: string }>;
  unresolvedAlerts: Array<Alert & { id: string }>;
  alertsLoading: boolean;
  addAlert: (alert: Omit<Alert, 'timestamp'>) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;

  // History
  history: Array<HistoryLog & { id: string }>;
  historyLoading: boolean;

  // Settings
  updateSettings: (settings: Partial<SystemSettings>) => Promise<void>;
  updateThresholds: (thresholds: Partial<SystemSettings['thresholds']>) => Promise<void>;
  updateRoverBehavior: (behavior: Partial<SystemSettings['roverBehavior']>) => Promise<void>;

  // System Health
  dbConnected: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

// Safe realistic simulation data for unauthenticated guest mode
const GUEST_MOCK_IOT: IoTReadings = {
  mq2: 245,
  mq135: 380,
  temperature: 24.6,
  humidity: 49.2,
  flame: 0,
  motion: 0,
  status: {
    online: true,
    lastHeartbeat: Date.now()
  }
};

const GUEST_MOCK_ROVER_STATUS: RoverStatus = {
  online: true,
  battery: 92,
  mode: 'auto',
  direction: 'stop',
  speed: 0,
  activeMission: 'Perimeter Inspection',
  missionStatus: 'idle',
  lastHeartbeat: Date.now()
};

const GUEST_MOCK_ROVER_CONTROL: RoverControl = {
  direction: 'stop',
  speed: 0,
  mode: 'auto'
};

const generateGuestHistory = (): Array<HistoryLog & { id: string }> => {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, i) => ({
    id: `guest-hist-${i}`,
    timestamp: now - (12 - i) * 60000,
    mq2: 230 + Math.floor(Math.sin(i) * 20),
    mq135: 360 + Math.floor(Math.cos(i) * 30),
    temperature: +(24 + Math.sin(i / 2) * 1.5).toFixed(1),
    humidity: +(48 + Math.cos(i / 2) * 2).toFixed(1),
    hazardScore: 18 + Math.floor(i % 5),
    riskLevel: 'SAFE' as const,
    source: 'simulation'
  }));
};

const GUEST_MOCK_ALERTS: Array<Alert & { id: string }> = [
  {
    id: 'alert-guest-1',
    timestamp: Date.now() - 3600000,
    type: 'ENVIRONMENTAL',
    severity: 'LOW',
    message: 'System initialization self-check passed. All sensors nominal.',
    resolved: true,
    resolvedAt: Date.now() - 3500000,
    source: 'system'
  },
  {
    id: 'alert-guest-2',
    timestamp: Date.now() - 900000,
    type: 'SENSOR',
    severity: 'INFO' as any,
    message: 'Autonomous Rover perimeter sweep completed without anomalies.',
    resolved: true,
    source: 'rover'
  }
];

export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, isGuest } = useAuth();

  // Use all hooks
  const { data: iotReadings, loading: iotLoading, error: iotError } = useIoTReadings();
  const { hazardScore, riskLevel, loading: hazardLoading, error: hazardError } = useHazardScore();
  const { comparison: hazardComparison, calculatedScore, divergenceThreshold } = useCalculatedHazardScore();
  const { 
    control: roverControl, 
    status: roverStatus, 
    loading: roverLoading,
    setDirection,
    setMode,
    updateControl,
    emergencyStop
  } = useRover();
  const { alerts, unresolvedAlerts, loading: alertsLoading, addAlert: addAlertFn, resolveAlert: resolveAlertFn } = useAlerts();
  const { history, loading: historyLoading } = useHistory();

  const isGuestActive = isGuest && !currentUser;

  const guestHistory = useMemo(() => generateGuestHistory(), []);

  const notifyGuestRestriction = (actionName: string) => {
    toast.error(`Action Restricted in Guest Mode`, {
      description: `"${actionName}" requires an authenticated operator account. Sign in to issue live commands.`
    });
  };

  // Safe mutation functions for guests
  const handleSetRoverDirection = async (direction: RoverControl['direction'], speed?: number) => {
    if (isGuestActive) {
      notifyGuestRestriction('Rover Direction Control');
      return;
    }
    return setDirection(direction, speed);
  };

  const handleSetRoverMode = async (mode: 'auto' | 'manual') => {
    if (isGuestActive) {
      notifyGuestRestriction('Rover Mode Toggle');
      return;
    }
    return setMode(mode);
  };

  const handleUpdateRoverControl = async (control: Partial<RoverControl>) => {
    if (isGuestActive) {
      notifyGuestRestriction('Rover Control Update');
      return;
    }
    return updateControl(control);
  };

  const handleTriggerEmergency = async () => {
    if (isGuestActive) {
      notifyGuestRestriction('Emergency Stop Trigger');
      return;
    }
    return emergencyStop();
  };

  const handleAddAlert = async (alert: Omit<Alert, 'timestamp'>) => {
    if (isGuestActive) {
      notifyGuestRestriction('Create Alert');
      return;
    }
    return addAlertFn(alert);
  };

  const handleResolveAlert = async (alertId: string) => {
    if (isGuestActive) {
      notifyGuestRestriction('Resolve Alert');
      return;
    }
    return resolveAlertFn(alertId);
  };

  const handleUpdateSettings = async (settings: Partial<SystemSettings>) => {
    if (isGuestActive) {
      notifyGuestRestriction('Modify System Settings');
      return;
    }
    return updateSettings(settings);
  };

  const handleUpdateThresholds = async (thresholds: Partial<SystemSettings['thresholds']>) => {
    if (isGuestActive) {
      notifyGuestRestriction('Update Sensor Thresholds');
      return;
    }
    return updateThresholds(thresholds);
  };

  const handleUpdateRoverBehavior = async (behavior: Partial<SystemSettings['roverBehavior']>) => {
    if (isGuestActive) {
      notifyGuestRestriction('Update Rover Behavior');
      return;
    }
    return updateRoverBehavior(behavior);
  };

  // If in guest mode, provide simulation data to avoid Firebase permission denied errors
  const effectiveIotReadings = isGuestActive ? (iotReadings || GUEST_MOCK_IOT) : iotReadings;
  const effectiveHazardScore = isGuestActive ? (hazardScore || 18) : hazardScore;
  const effectiveRiskLevel = isGuestActive ? (riskLevel || 'SAFE') : riskLevel;
  const effectiveRoverStatus = isGuestActive ? (roverStatus || GUEST_MOCK_ROVER_STATUS) : roverStatus;
  const effectiveRoverControl = isGuestActive ? (roverControl || GUEST_MOCK_ROVER_CONTROL) : roverControl;
  const effectiveHistory = isGuestActive ? (history && history.length > 0 ? history : guestHistory) : history;
  const effectiveAlerts = isGuestActive ? (alerts && alerts.length > 0 ? alerts : GUEST_MOCK_ALERTS) : alerts;
  const effectiveUnresolvedAlerts = isGuestActive ? [] : unresolvedAlerts;

  const dbConnected = isGuestActive ? true : (!iotError && (iotReadings !== null || !iotLoading));

  const value: FirebaseContextType = {
    // IoT
    iotReadings: effectiveIotReadings,
    iotLoading: isGuestActive ? false : iotLoading,
    iotError: isGuestActive ? null : iotError,

    // Hazard Score (Device-reported)
    hazardScore: effectiveHazardScore,
    riskLevel: effectiveRiskLevel,
    hazardLoading: isGuestActive ? false : hazardLoading,
    hazardError: isGuestActive ? null : hazardError,

    // Calculated Hazard Score (Mathematical Model)
    calculatedHazardScore: isGuestActive ? (calculatedScore || 19) : calculatedScore,
    calculatedRiskLevel: isGuestActive ? 'SAFE' : (hazardComparison?.calculatedRiskLevel || 'SAFE'),
    hazardComparison,
    divergenceThreshold,

    // Rover
    roverControl: effectiveRoverControl,
    roverStatus: effectiveRoverStatus,
    roverLoading: isGuestActive ? false : roverLoading,
    setRoverDirection: handleSetRoverDirection,
    setRoverMode: handleSetRoverMode,
    updateRoverControl: handleUpdateRoverControl,
    triggerEmergency: handleTriggerEmergency,

    // Alerts
    alerts: effectiveAlerts,
    unresolvedAlerts: effectiveUnresolvedAlerts,
    alertsLoading: isGuestActive ? false : alertsLoading,
    addAlert: handleAddAlert,
    resolveAlert: handleResolveAlert,

    // History
    history: effectiveHistory,
    historyLoading: isGuestActive ? false : historyLoading,

    // Settings
    updateSettings: handleUpdateSettings,
    updateThresholds: handleUpdateThresholds,
    updateRoverBehavior: handleUpdateRoverBehavior,

    // System Health
    dbConnected
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextType => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
