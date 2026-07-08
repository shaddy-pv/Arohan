/**
 * Client-Side Monitoring Service
 * 
 * This service runs in the browser and provides automated monitoring
 * without requiring Cloud Functions (100% FREE alternative)
 * 
 * Features:
 * - Auto-create alerts on hazards
 * - Auto-log history periodically
 * - Monitor battery levels
 * - Monitor connection status
 * 
 * Limitations:
 * - Only works when browser is open
 * - Stops when page is closed
 * - One user must keep dashboard open
 */

import { ref, onValue, push, set, get } from 'firebase/database';
import { database } from '@/lib/firebase';

interface MonitoringConfig {
  historyInterval: number; // milliseconds (default: 5 minutes)
  enabled: boolean;
}

class ClientMonitoringService {
  private config: MonitoringConfig = {
    historyInterval: 5 * 60 * 1000, // 5 minutes
    enabled: false
  };

  private historyTimer: NodeJS.Timeout | null = null;
  private unsubscribers: Array<() => void> = [];
  private lastValues: any = {};

  /**
   * Start monitoring service
   */
  start() {
    if (this.config.enabled) {
      return;
    }

    this.config.enabled = true;

    // Monitor IoT readings for hazards
    this.monitorHazards();

    // Monitor rover battery
    this.monitorBattery();

    // Monitor node connection
    this.monitorConnection();

    // Start periodic history logging
    this.startHistoryLogging();
  }

  /**
   * Stop monitoring service
   */
  stop() {
    this.config.enabled = false;

    // Clear history timer
    if (this.historyTimer) {
      clearInterval(this.historyTimer);
      this.historyTimer = null;
    }

    // Unsubscribe from all listeners
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  /**
   * Monitor IoT readings for hazardous conditions
   */
  private monitorHazards() {
    const iotRef = ref(database, 'ronin/iot');

    const unsubscribe = onValue(iotRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const before = this.lastValues.iot || {};
      this.lastValues.iot = data;

      // Fire detection - CRITICAL
      if (data.flame && !before.flame) {
        this.createAlert({
          type: 'Fire Detected',
          severity: 'critical',
          summary: '🔥 Flame sensor triggered - immediate evacuation required!',
          details: {
            location: 'IoT Station',
            temperature: data.temperature,
            timestamp: Date.now()
          }
        });
      }

      // High gas levels - HIGH SEVERITY
      if (data.mq2 > 700 && before.mq2 <= 700) {
        this.createAlert({
          type: 'Gas Leak',
          severity: 'high',
          summary: `⚠️ Dangerous gas levels detected (MQ-2: ${data.mq2})`,
          details: {
            mq2: data.mq2,
            mq135: data.mq135,
            location: 'IoT Station',
            timestamp: Date.now()
          }
        });
      }

      // Poor air quality - MEDIUM SEVERITY
      if (data.mq135 > 900 && before.mq135 <= 900) {
        this.createAlert({
          type: 'Poor Air Quality',
          severity: 'medium',
          summary: `Air quality degraded (MQ-135: ${data.mq135})`,
          details: {
            mq135: data.mq135,
            location: 'IoT Station',
            timestamp: Date.now()
          }
        });
      }

      // High temperature - MEDIUM SEVERITY
      if (data.temperature > 40 && before.temperature <= 40) {
        this.createAlert({
          type: 'High Temperature',
          severity: 'medium',
          summary: `Temperature critical: ${data.temperature.toFixed(1)}°C`,
          details: {
            temperature: data.temperature,
            humidity: data.humidity,
            location: 'IoT Station',
            timestamp: Date.now()
          }
        });
      }

      // High hazard score - AUTO-DISPATCH ROVER
      if (data.hazardScore > 60 && before.hazardScore <= 60) {
        this.createAlert({
          type: 'High Hazard Level',
          severity: 'high',
          summary: `Hazard score critical: ${data.hazardScore.toFixed(1)}/100`,
          details: {
            hazardScore: data.hazardScore,
            riskLevel: data.riskLevel,
            mq2: data.mq2,
            mq135: data.mq135,
            temperature: data.temperature,
            flame: data.flame,
            motion: data.motion,
            timestamp: Date.now()
          }
        });

        // Check if auto-dispatch is enabled
        this.checkAutoDispatch(data.hazardScore);
      }

      // Motion detected - LOW SEVERITY
      if (data.motion && !before.motion) {
        this.createAlert({
          type: 'Motion Detected',
          severity: 'low',
          summary: '👤 Motion detected in monitored area',
          details: {
            location: 'IoT Station',
            timestamp: Date.now()
          }
        });
      }
    });

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Monitor rover battery levels
   */
  private monitorBattery() {
    const batteryRef = ref(database, 'ronin/rover/status/battery');

    const unsubscribe = onValue(batteryRef, (snapshot) => {
      const battery = snapshot.val();
      if (battery === null) return;

      const before = this.lastValues.battery || 100;
      this.lastValues.battery = battery;

      // Low battery warning (20%)
      if (battery <= 20 && before > 20) {
        this.createAlert({
          type: 'Low Battery',
          severity: 'medium',
          summary: `🔋 Rover battery low: ${battery}%`,
          details: {
            battery,
            recommendation: 'Return rover to base for charging',
            timestamp: Date.now()
          }
        });
      }

      // Critical battery (10%)
      if (battery <= 10 && before > 10) {
        this.createAlert({
          type: 'Critical Battery',
          severity: 'high',
          summary: `🔋 Rover battery critical: ${battery}% - Return to base immediately!`,
          details: {
            battery,
            recommendation: 'Rover may shut down soon',
            timestamp: Date.now()
          }
        });

        // Auto-return to base if enabled
        this.checkAutoReturn();
      }
    });

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Monitor IoT node connection status
   */
  private monitorConnection() {
    const onlineRef = ref(database, 'ronin/iot/status/online');

    const unsubscribe = onValue(onlineRef, (snapshot) => {
      const online = snapshot.val();
      if (online === null) return;

      const before = this.lastValues.online ?? true;
      this.lastValues.online = online;

      // Node went offline
      if (before === true && online === false) {
        this.createAlert({
          type: 'Node Offline',
          severity: 'high',
          summary: '📡 IoT sensor node has gone offline',
          details: {
            lastHeartbeat: Date.now(),
            recommendation: 'Check device power and network connection',
            timestamp: Date.now()
          }
        });
      }

      // Node came back online
      if (before === false && online === true) {
        this.createAlert({
          type: 'Node Online',
          severity: 'low',
          summary: '✅ IoT sensor node is back online',
          details: {
            timestamp: Date.now()
          }
        });
      }
    });

    this.unsubscribers.push(unsubscribe);
  }

  /**
   * Start periodic history logging
   */
  private startHistoryLogging() {
    // Log immediately
    this.logHistory();

    // Then log every interval
    this.historyTimer = setInterval(() => {
      this.logHistory();
    }, this.config.historyInterval);
  }

  /**
   * Log current sensor readings to history
   */
  private async logHistory() {
    try {
      const iotSnapshot = await get(ref(database, 'ronin/iot'));
      const data = iotSnapshot.val();

      if (!data) {
        return;
      }

      const historyEntry = {
        timestamp: Date.now(),
        mq2: data.mq2 || 0,
        mq135: data.mq135 || 0,
        temperature: data.temperature || 0,
        humidity: data.humidity || 0,
        flame: data.flame || false,
        motion: data.motion || false,
        hazardScore: data.hazardScore || 0,
        riskLevel: data.riskLevel || (
          data.hazardScore < 30 ? 'SAFE' :
          data.hazardScore < 60 ? 'WARNING' : 'DANGER'
        )
      };

      await push(ref(database, 'ronin/history'), historyEntry);

      // Clean up old history (keep last 1000)
      this.cleanupHistory();
    } catch (error) {
      console.error('[ClientMonitoring] Error logging history:', error);
    }
  }

  /**
   * Clean up old history entries
   */
  private async cleanupHistory() {
    try {
      const historySnapshot = await get(ref(database, 'ronin/history'));
      const historyData = historySnapshot.val();

      if (!historyData) return;

      const entries = Object.entries(historyData);
      if (entries.length > 1000) {
        // Sort by timestamp and remove oldest
        const sorted = entries.sort((a: any, b: any) => b[1].timestamp - a[1].timestamp);
        const toDelete = sorted.slice(1000);

        const updates: any = {};
        toDelete.forEach(([key]) => {
          updates[`ronin/history/${key}`] = null;
        });

        await set(ref(database), updates);
      }
    } catch (error) {
      console.error('[ClientMonitoring] Error cleaning history:', error);
    }
  }

  /**
   * Create an alert in the database
   */
  private async createAlert(alert: any) {
    try {
      const alertData = {
        ...alert,
        timestamp: Date.now(),
        resolved: false
      };

      await push(ref(database, 'ronin/alerts'), alertData);
    } catch (error) {
      console.error('[ClientMonitoring] Error creating alert:', error);
    }
  }

  /**
   * Check if auto-dispatch should be triggered
   */
  private async checkAutoDispatch(hazardScore: number) {
    try {
      const settingsSnapshot = await get(ref(database, 'ronin/settings/roverBehavior'));
      const roverBehavior = settingsSnapshot.val();

      if (roverBehavior && roverBehavior.autoDispatchEnabled) {
        const dispatchTime = Date.now();

        // Set rover control to auto mode
        await set(ref(database, 'ronin/rover/control'), {
          mode: 'auto',
          direction: 'forward',
          speed: 50,
          emergency: false
        });

        // Create mission record in Firebase
        await set(ref(database, 'ronin/rover/mission'), {
          state: 'DISPATCHED',
          dispatchedAt: dispatchTime,
          reason: `High hazard score detected (${hazardScore.toFixed(1)}/100)`,
          target: 'Investigation site',
          updatedAt: dispatchTime,
          progress: 0,
          hazardScore: hazardScore
        });

        // Create alert for notification
        await this.createAlert({
          type: 'Rover Dispatched',
          severity: 'medium',
          summary: `🤖 Rover automatically dispatched to investigate hazard (Score: ${hazardScore.toFixed(1)})`,
          details: {
            reason: `Auto-dispatch triggered by high hazard score (${hazardScore.toFixed(1)}/100)`,
            hazardScore,
            location: 'Investigation site',
            timestamp: dispatchTime
          }
        });
      }
    } catch (error) {
      console.error('[ClientMonitoring] Error checking auto-dispatch:', error);
    }
  }

  /**
   * Check if rover should auto-return to base
   */
  private async checkAutoReturn() {
    try {
      const settingsSnapshot = await get(ref(database, 'ronin/settings/roverBehavior/returnToBaseAfterCheck'));
      const returnToBase = settingsSnapshot.val();

      if (returnToBase === true) {
        await set(ref(database, 'ronin/rover/control'), {
          mode: 'auto',
          direction: 'back',
          speed: 30,
          emergency: false
        });
      }
    } catch (error) {
      console.error('[ClientMonitoring] Error checking auto-return:', error);
    }
  }

  /**
   * Check if monitoring is running
   */
  isRunning(): boolean {
    return this.config.enabled;
  }

  /**
   * Set history logging interval
   */
  setHistoryInterval(minutes: number) {
    this.config.historyInterval = minutes * 60 * 1000;
    
    if (this.config.enabled) {
      // Restart history logging with new interval
      if (this.historyTimer) {
        clearInterval(this.historyTimer);
      }
      this.startHistoryLogging();
    }
  }
}

// Export singleton instance
export const clientMonitoring = new ClientMonitoringService();
