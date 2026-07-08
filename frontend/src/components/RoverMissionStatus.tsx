/**
 * Rover Mission Status Component
 * 
 * Displays real-time rover dispatch and mission status:
 * - Dispatch notifications
 * - Mission progress
 * - Arrival status
 * - Current activity
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Loader2, CheckCircle2, AlertCircle, Navigation, MapPin, Clock, Activity } from 'lucide-react';

interface RoverMission {
  status: 'IDLE' | 'DISPATCHED' | 'EN_ROUTE' | 'ARRIVED' | 'INVESTIGATING' | 'RETURNING' | 'COMPLETED';
  dispatchedAt?: number;
  arrivedAt?: number;
  completedAt?: number;
  reason?: string;
  location?: string;
  progress?: number; // 0-100
}

export const RoverMissionStatus = () => {
  const [mission, setMission] = useState<RoverMission>({ status: 'IDLE' });
  const [roverControl, setRoverControl] = useState<any>(null);
  const [roverStatus, setRoverStatus] = useState<any>(null);
  const [lastAlert, setLastAlert] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to rover control
  useEffect(() => {
    const controlRef = ref(database, 'ronin/rover/control');
    const unsubscribe = onValue(controlRef, (snapshot) => {
      const data = snapshot.val();
      setRoverControl(data);
      
      // Update mission status based on control mode
      if (data?.mode === 'auto') {
        setMission(prev => {
          if (prev.status === 'IDLE') {
            return {
              ...prev,
              status: 'DISPATCHED',
              dispatchedAt: Date.now()
            };
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to rover status
  useEffect(() => {
    const statusRef = ref(database, 'ronin/rover/status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      setRoverStatus(data);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to latest alerts for dispatch reasons
  useEffect(() => {
    const alertsRef = ref(database, 'ronin/alerts');
    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      // Get most recent "Rover Dispatched" alert
      const alerts = Object.values(data) as any[];
      const dispatchAlerts = alerts
        .filter(a => a.type === 'Rover Dispatched')
        .sort((a, b) => b.timestamp - a.timestamp);

      if (dispatchAlerts.length > 0) {
        setLastAlert(dispatchAlerts[0]);
        setMission(prev => ({
          ...prev,
          reason: dispatchAlerts[0].details?.reason || 'High hazard detected',
          location: dispatchAlerts[0].details?.location || 'Investigation site'
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time mission tracking from Firebase
  useEffect(() => {
    const missionRef = ref(database, 'ronin/rover/mission');
    const unsubscribe = onValue(missionRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        setMission({
          status: data.state || 'IDLE',
          dispatchedAt: data.dispatchedAt,
          arrivedAt: data.arrivedAt,
          completedAt: data.completedAt,
          reason: data.reason,
          location: data.target,
          progress: data.progress || 0
        });
      }
      if (data) {
        setMission({
          status: data.status || 'IDLE',
          dispatchedAt: data.dispatchedAt,
          arrivedAt: data.arrivedAt,
          completedAt: data.completedAt,
          reason: data.reason,
          location: data.location,
          progress: data.progress || 0
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const getStatusIcon = () => {
    switch (mission.status) {
      case 'IDLE':
        return <MapPin className="w-5 h-5 text-muted-foreground" />;
      case 'DISPATCHED':
      case 'EN_ROUTE':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'ARRIVED':
        return <CheckCircle2 className="w-5 h-5 text-safe" />;
      case 'INVESTIGATING':
        return <Activity className="w-5 h-5 text-warning animate-pulse" />;
      case 'RETURNING':
        return <Navigation className="w-5 h-5 text-primary" />;
      case 'COMPLETED':
        return <CheckCircle2 className="w-5 h-5 text-safe" />;
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (mission.status) {
      case 'IDLE':
        return 'bg-secondary text-secondary-foreground';
      case 'DISPATCHED':
      case 'EN_ROUTE':
        return 'bg-primary text-primary-foreground';
      case 'ARRIVED':
        return 'bg-safe text-white';
      case 'INVESTIGATING':
        return 'bg-warning text-black';
      case 'RETURNING':
        return 'bg-primary text-primary-foreground';
      case 'COMPLETED':
        return 'bg-safe text-white';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusText = () => {
    switch (mission.status) {
      case 'IDLE':
        return 'Standby';
      case 'DISPATCHED':
        return 'Dispatched';
      case 'EN_ROUTE':
        return 'En Route';
      case 'ARRIVED':
        return 'Arrived at Site';
      case 'INVESTIGATING':
        return 'Investigating';
      case 'RETURNING':
        return 'Returning to Base';
      case 'COMPLETED':
        return 'Mission Complete';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getElapsedTime = (startTime?: number) => {
    if (!startTime) return 'N/A';
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getStatusIcon()}
            Rover Mission Status
          </CardTitle>
          <Badge className={getStatusColor()}>
            {getStatusText()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mission Progress Bar */}
        {(mission.status === 'DISPATCHED' || mission.status === 'EN_ROUTE') && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress to site</span>
              <span>{mission.progress?.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${mission.progress || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Mission Details */}
        {mission.status !== 'IDLE' && (
          <div className="space-y-2 text-sm">
            {mission.reason && (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Dispatch Reason:</div>
                  <div className="text-muted-foreground">{mission.reason}</div>
                </div>
              </div>
            )}

            {mission.location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Target Location:</div>
                  <div className="text-muted-foreground">{mission.location}</div>
                </div>
              </div>
            )}

            {mission.dispatchedAt && (
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Dispatched At:</div>
                  <div className="text-muted-foreground">{formatTime(mission.dispatchedAt)}</div>
                  <div className="text-xs text-muted-foreground">
                    Elapsed: {getElapsedTime(mission.dispatchedAt)}
                  </div>
                </div>
              </div>
            )}

            {mission.arrivedAt && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-safe flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Arrived At:</div>
                  <div className="text-muted-foreground">{formatTime(mission.arrivedAt)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Idle State */}
        {mission.status === 'IDLE' && (
          <div className="text-center py-4 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <div className="text-sm">Rover is on standby</div>
            <div className="text-xs mt-1">
              Will auto-dispatch when hazard score exceeds threshold
            </div>
          </div>
        )}

        {/* Rover Status Info */}
        <div className="pt-3 border-t border-border">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Mode</div>
              <div className="font-semibold capitalize">
                {roverControl?.mode || 'Manual'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Battery</div>
              <div className="font-semibold">
                {roverStatus?.battery || 0}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Connection</div>
              <div className="font-semibold">
                {(roverStatus?.online && roverStatus?.lastHeartbeat && (currentTime - roverStatus.lastHeartbeat) / 1000 < 15) ? (
                  <span className="text-safe">Online</span>
                ) : (
                  <span className="text-danger">Offline</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Direction</div>
              <div className="font-semibold capitalize">
                {roverControl?.direction || 'Stop'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
