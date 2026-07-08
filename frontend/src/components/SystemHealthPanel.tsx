import { Card } from "@/components/ui/card";
import { Circle, Database, Cpu, Activity } from "lucide-react";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useState, useEffect } from "react";

interface SystemLog {
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'error';
}

export const SystemHealthPanel = () => {
  const { iotReadings, roverStatus, dbConnected } = useFirebase();
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // IoT staleness check
  const iotLastDate = iotReadings?._localTimestamp ? new Date(iotReadings._localTimestamp) : null;
  const iotStaleSec = iotLastDate ? (currentTime - iotLastDate.getTime()) / 1000 : Infinity;
  const iotOnline = (iotReadings?.status?.online ?? false) && iotStaleSec < 15;

  // Rover staleness check
  const roverHeartbeat = roverStatus?.lastHeartbeat || 0;
  const roverStaleSec = roverHeartbeat > 0 ? (currentTime - roverHeartbeat) / 1000 : Infinity;
  const roverOnline = (roverStatus?.online ?? false) && roverStaleSec < 15;

  // Generate system logs based on status changes
  useEffect(() => {
    const newLogs: SystemLog[] = [];

    // Check IoT status
    if (iotOnline) {
      newLogs.push({
        timestamp: Date.now(),
        message: 'IoT node heartbeat received',
        type: 'info'
      });
    } else {
      newLogs.push({
        timestamp: Date.now(),
        message: 'IoT node connection lost',
        type: 'error'
      });
    }

    // Check Rover status
    if (roverOnline) {
      newLogs.push({
        timestamp: Date.now(),
        message: `Rover online - Battery: ${roverStatus?.battery || 0}%`,
        type: 'info'
      });
    } else {
      newLogs.push({
        timestamp: Date.now(),
        message: 'Rover offline',
        type: 'warning'
      });
    }

    // Check DB connection
    if (dbConnected) {
      newLogs.push({
        timestamp: Date.now(),
        message: 'Firebase database connected',
        type: 'info'
      });
    } else {
      newLogs.push({
        timestamp: Date.now(),
        message: 'Database connection error',
        type: 'error'
      });
    }

    // Add hazard detection logs
    if (iotReadings?.flame) {
      newLogs.push({
        timestamp: Date.now(),
        message: '🔥 FIRE DETECTED - Alert triggered',
        type: 'error'
      });
    }

    if (iotReadings?.motion) {
      newLogs.push({
        timestamp: Date.now(),
        message: '👤 Motion detected in monitored area',
        type: 'warning'
      });
    }

    if (iotReadings?.mq2 && iotReadings.mq2 > 700) {
      newLogs.push({
        timestamp: Date.now(),
        message: `⚠️ High gas levels detected (MQ-2: ${iotReadings.mq2})`,
        type: 'error'
      });
    }

    // Update logs (keep last 5)
    setSystemLogs(prev => {
      const combined = [...newLogs, ...prev];
      return combined.slice(0, 5);
    });
  }, [iotOnline, roverOnline, dbConnected, iotReadings?.flame, iotReadings?.motion, iotReadings?.mq2, roverStatus?.battery]);

  const getStatusColor = (online: boolean) => {
    return online ? 'text-safe' : 'text-danger';
  };

  const getStatusBg = (online: boolean) => {
    return online ? 'bg-safe' : 'bg-danger';
  };

  const getLogIcon = (type: SystemLog['type']) => {
    switch (type) {
      case 'error':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🟢';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="w-6 h-6" />
        <h3 className="text-lg font-bold">System Health</h3>
      </div>

      {/* Connectivity Status */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">IoT Node</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className={`w-2 h-2 rounded-full ${getStatusBg(iotOnline)}`} />
            <span className={`text-sm font-semibold ${getStatusColor(iotOnline)}`}>
              {iotOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Rover</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className={`w-2 h-2 rounded-full ${getStatusBg(roverOnline)}`} />
            <span className={`text-sm font-semibold ${getStatusColor(roverOnline)}`}>
              {roverOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Database</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className={`w-2 h-2 rounded-full ${getStatusBg(dbConnected)}`} />
            <span className={`text-sm font-semibold ${getStatusColor(dbConnected)}`}>
              {dbConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>

      {/* System Logs */}
      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Recent System Logs</h4>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {systemLogs.length > 0 ? (
            systemLogs.map((log, idx) => (
              <div key={idx} className="text-xs p-2 bg-secondary/50 rounded">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{getLogIcon(log.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-muted-foreground truncate">
                      {log.message}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">
              No recent system logs
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
