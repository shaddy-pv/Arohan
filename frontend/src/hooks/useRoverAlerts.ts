import { useState, useEffect, useCallback, useMemo } from 'react';
import { RoverAlert, RoverAlertType } from '@/types/alerts';

interface UseRoverAlertsReturn {
  alerts: RoverAlert[];
  recentAlerts: RoverAlert[];
  addAlert: (type: RoverAlertType, message: string, options?: {
    confidence?: number;
    snapshotUrl?: string;
    meta?: Record<string, any>;
  }) => void;
  clearAlerts: () => void;
  removeAlert: (id: string) => void;
}

// CV backend URL - only used if backend is available
const CV_BACKEND_URL = import.meta.env.VITE_CV_BACKEND_URL || 'http://localhost:5000';

export const useRoverAlerts = (): UseRoverAlertsReturn => {
  const [alerts, setAlerts] = useState<RoverAlert[]>([]);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Load alerts from localStorage on mount
  useEffect(() => {
    const savedAlerts = localStorage.getItem('rover-alerts');
    if (savedAlerts) {
      try {
        const parsed = JSON.parse(savedAlerts);
        setAlerts(parsed);
      } catch (error) {
        console.error('Failed to parse saved alerts:', error);
      }
    }
  }, []);

  // Save alerts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('rover-alerts', JSON.stringify(alerts));
  }, [alerts]);

  // Check if backend is available on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${CV_BACKEND_URL}/health`, {
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          setBackendAvailable(true);
          
          // Fetch initial alerts if backend is available
          const alertsResponse = await fetch(`${CV_BACKEND_URL}/alerts`, {
            signal: AbortSignal.timeout(3000)
          });
          
          if (alertsResponse.ok) {
            const backendAlerts = await alertsResponse.json();
            if (Array.isArray(backendAlerts)) {
              setAlerts(prev => {
                // Merge with existing alerts, avoiding duplicates
                const existingIds = new Set(prev.map(a => a.id));
                const newAlerts = backendAlerts.filter(a => !existingIds.has(a.id));
                return [...prev, ...newAlerts];
              });
            }
          }
        }
      } catch (error) {
        // Backend not available - use local storage only
        console.debug('CV Backend not available, using local storage only');
        setBackendAvailable(false);
      }
    };

    checkBackend();
  }, []);

  // Poll for new alerts only if backend is available
  useEffect(() => {
    if (!backendAvailable) return;

    const fetchBackendAlerts = async () => {
      try {
        const response = await fetch(`${CV_BACKEND_URL}/alerts`, {
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          const backendAlerts = await response.json();
          if (Array.isArray(backendAlerts)) {
            setAlerts(prev => {
              // Merge with existing alerts, avoiding duplicates
              const existingIds = new Set(prev.map(a => a.id));
              const newAlerts = backendAlerts.filter(a => !existingIds.has(a.id));
              return [...prev, ...newAlerts];
            });
          }
        }
      } catch (error) {
        console.debug('Backend polling failed:', error);
        setBackendAvailable(false); // Mark as unavailable if polling fails
      }
    };
    
    // Poll for new alerts every 30 seconds only if backend is available
    const interval = setInterval(fetchBackendAlerts, 30000);
    return () => clearInterval(interval);
  }, [backendAvailable]);

  // Add new alert
  const addAlert = useCallback((
    type: RoverAlertType, 
    message: string, 
    options: {
      confidence?: number;
      snapshotUrl?: string;
      meta?: Record<string, any>;
    } = {}
  ) => {
    const newAlert: RoverAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      createdAt: new Date().toISOString(),
      ...options
    };

    setAlerts(prev => [newAlert, ...prev]);

    // Try to send to backend only if available
    if (backendAvailable) {
      fetch(`${CV_BACKEND_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlert),
        signal: AbortSignal.timeout(3000)
      }).catch(() => {
        console.debug('Failed to send alert to backend');
        setBackendAvailable(false); // Mark as unavailable if sending fails
      });
    }
  }, []);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Remove specific alert
  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  // Deduplicate alerts by ID before exposing to consumers.
  // Race conditions between localStorage hydration, backend polling,
  // and Firebase push can produce entries with the same id.
  const dedupedAlerts = useMemo(() => {
    const seen = new Map<string, RoverAlert>();
    for (const a of alerts) {
      if (!seen.has(a.id)) seen.set(a.id, a);
    }
    return Array.from(seen.values());
  }, [alerts]);

  // Get recent alerts (last 3)
  const recentAlerts = dedupedAlerts.slice(0, 3);

  return {
    alerts: dedupedAlerts,
    recentAlerts,
    addAlert,
    clearAlerts,
    removeAlert
  };
};