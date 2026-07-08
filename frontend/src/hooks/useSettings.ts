import { useState, useEffect } from 'react';
import { subscribeToSettings, SystemSettings } from '@/lib/firebaseService';

const DEFAULT_SETTINGS: SystemSettings = {
  thresholds: {
    safeMax: 30,
    warningMax: 60,
    dangerMin: 60
  },
  sensorRanges: {
    mq135: { min: 300, max: 1000 },
    mq2: { min: 200, max: 800 },
    temp: { min: 20, max: 50 }
  },
  roverBehavior: {
    autoDispatchEnabled: true,
    autoDispatchThreshold: 60,
    returnToBaseAfterCheck: true,
    checkDuration: 300 // 5 minutes
  },
  whatsappNotifications: {
    enabled: true,
    recipientNumber: '9555971850',
    minSeverity: 'low'
  }
};

export const useSettings = () => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const unsubscribe = subscribeToSettings((data) => {
        if (data) {
          setSettings(data);
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
        setLoading(false);
      });

      return () => {
        unsubscribe();
      };
    } catch (err) {
      setError(err as Error);
      setLoading(false);
    }
  }, []);

  return { settings, loading, error };
};
