import { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, off } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { logger } from '@/lib/logger';

// Extended IoT Readings interface matching firmware schema
export interface IoTReadings {
  mq2: number;
  mq135: number;
  mq135_raw: 0 | 1;
  mq135_digital: 0 | 1;
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
  _localTimestamp?: number;
  emergency: {
    active: boolean;
    timestamp: number;
  };
}

/**
 * Hook to subscribe to live IoT readings from Firebase Realtime Database
 * @param path - Database path to subscribe to (default: /ronin/iot)
 * @returns Object containing data, loading state, and error
 */
export const useIoTReadings = (path: string = '/ronin/iot') => {
  const [data, setData] = useState<IoTReadings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Wait for auth state to be ready
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setAuthReady(true);
      if (!user) {
        console.debug('[useIoTReadings] User not authenticated');
        setLoading(false);
        setError(new Error('User not authenticated'));
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Wait for auth to be ready
    if (!authReady) {
      return;
    }

    // Check if user is authenticated
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.debug('[useIoTReadings] User not authenticated, skipping data fetch');
      setLoading(false);
      setError(new Error('User not authenticated'));
      return;
    }

    console.debug('[useIoTReadings] User authenticated, fetching data for:', currentUser.email);
    setLoading(true);
    setError(null);

    try {
      const db = getDatabase();
      const nodeRef = ref(db, path);

      // Subscribe to real-time updates
      const unsubscribe = onValue(
        nodeRef,
        (snapshot) => {
          const val = snapshot.val();

          if (!val) {
            // Don't clear data immediately - keep showing last known values
            // This prevents blank screens when IoT device is temporarily offline
            console.debug('[useIoTReadings] No data found at path:', path, '- keeping last known values');
            setLoading(false);
            return;
          }

          // Normalize data according to firmware schema
          const normalized: IoTReadings = {
            // Gas sensors
            mq2: Number(val.mq2) || 0,
            mq135: Number(val.mq135) || 0,
            mq135_raw: (val.mq135_raw == 1 || val.mq135_raw === '1') ? 1 : 0,
            mq135_digital: (val.mq135_digital == 1 || val.mq135_digital === '1') ? 1 : 0,

            // Environmental sensors
            temperature: Number(val.temperature) || 0,
            humidity: Number(val.humidity) || 0,

            // Binary sensors
            flame: Boolean(val.flame),
            motion: Boolean(val.motion),

            // Hazard calculation
            hazardScore: Math.max(0, Math.min(100, Number(val.hazardScore) || 0)),
            riskLevel: val.riskLevel || (
              (Number(val.hazardScore) || 0) <= 30 ? 'SAFE' :
              (Number(val.hazardScore) || 0) <= 60 ? 'WARNING' : 'DANGER'
            ),

            // Status
            status: {
              online: Boolean(val.status?.online ?? true),
              lastHeartbeat: Number(val.status?.lastHeartbeat) || Date.now()
            },

            _localTimestamp: Date.now(),

            // Emergency
            emergency: {
              active: Boolean(val.emergency?.active ?? false),
              timestamp: Number(val.emergency?.timestamp) || 0
            }
          };

          // Log snapshot for debugging
          console.debug('[useIoTReadings] snapshot:', normalized);

          // Log changed fields in development
          if (process.env.NODE_ENV === 'development' && data) {
            const changes: string[] = [];
            if (data.mq2 !== normalized.mq2) changes.push(`mq2: ${data.mq2} → ${normalized.mq2}`);
            if (data.mq135 !== normalized.mq135) changes.push(`mq135: ${data.mq135} → ${normalized.mq135}`);
            if (data.temperature !== normalized.temperature) changes.push(`temp: ${data.temperature} → ${normalized.temperature}`);
            if (data.humidity !== normalized.humidity) changes.push(`humidity: ${data.humidity} → ${normalized.humidity}`);
            if (data.flame !== normalized.flame) changes.push(`flame: ${data.flame} → ${normalized.flame}`);
            if (data.motion !== normalized.motion) changes.push(`motion: ${data.motion} → ${normalized.motion}`);
            if (data.hazardScore !== normalized.hazardScore) changes.push(`hazardScore: ${data.hazardScore} → ${normalized.hazardScore}`);
            if (data.riskLevel !== normalized.riskLevel) changes.push(`riskLevel: ${data.riskLevel} → ${normalized.riskLevel}`);
            
            if (changes.length > 0) {
              console.info('[useIoTReadings] Changes detected:', changes.join(', '));
            }
          }

          setData(normalized);
          setLoading(false);
        },
        (err) => {
          logger.error('useIoTReadings Firebase error', err);
          setError(err as Error);
          setLoading(false);
        }
      );

      // Cleanup on unmount
      return () => {
        logger.debug('useIoTReadings cleaning up listener for path', path);
        off(nodeRef);
      };
    } catch (err) {
      logger.error('useIoTReadings setup error', err);
      setError(err as Error);
      setLoading(false);
    }
  }, [path, authReady]); // Removed 'data' from dependencies to prevent infinite loop

  return { data, loading, error };
};
