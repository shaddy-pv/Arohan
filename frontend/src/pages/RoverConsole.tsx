import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorState } from "@/components/ErrorState";
import { SimpleMjpegStream } from "@/components/SimpleMjpegStream";
import { RecentAlerts } from "@/components/RecentAlerts";
import { SavedPaths } from "@/components/SavedPaths";
import { SensorDashboard } from "@/components/SensorDashboard";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, VideoOff, Battery, MapPin, Send, CheckCircle, Navigation } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useToast } from "@/hooks/use-toast";
import { dispatchRover, markRoverArrived, resetMission, subscribeToMission, type RoverMission } from "@/services/roverMissionService";

const RoverConsole = () => {
  const [speed, setSpeed] = useState([50]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [mission, setMission] = useState<RoverMission | null>(null);
  
  const { toast } = useToast();
  
  // Get Firebase data
  const {
    roverControl,
    roverStatus,
    roverLoading,
    setRoverDirection,
    setRoverMode,
    triggerEmergency
  } = useFirebase();

  const mode = roverControl?.mode ?? 'manual';
  const currentDirection = roverControl?.direction ?? 'stop';
  const currentSpeed = roverControl?.speed ?? 50;
  const battery = roverStatus?.battery ?? 0;
  const location = roverStatus?.location ?? 'Unknown';
  const roverOnline = roverStatus?.online ?? false;

  // Subscribe to mission updates
  useEffect(() => {
    const unsubscribe = subscribeToMission((missionData) => {
      setMission(missionData);
    });

    return () => unsubscribe();
  }, []);



  // Movement control — fire-and-forget for zero delay
  const handleMove = useCallback((direction: 'forward' | 'back' | 'left' | 'right' | 'stop') => {
    if (mode === 'auto') return;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const spd = direction === 'stop' ? 0 : speed[0];
    // Fire-and-forget: don't await either call
    fetch(`${backendUrl}/rover/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, speed: spd }),
    }).catch(() => {});
    // Sync Firebase in background (for UI state)
    setRoverDirection(direction, spd).catch(() => {});
  }, [mode, speed, setRoverDirection]);

  // Stop movement — fire-and-forget
  const handleStop = useCallback(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    fetch(`${backendUrl}/rover/stop`, { method: 'POST' }).catch(() => {});
    setRoverDirection('stop', 0).catch(() => {});
  }, [setRoverDirection]);

  // Mode toggle
  const handleModeToggle = useCallback(async (newMode: 'auto' | 'manual') => {
    try {
      if (newMode === 'manual') {
        await resetMission();
      } else {
        await setRoverMode(newMode);
      }
      toast({
        title: `${newMode === 'auto' ? 'Auto' : 'Manual'} Mode Activated`,
        description: newMode === 'auto' 
          ? 'Rover will respond to hazard alerts automatically' 
          : 'You now have manual control of the rover'
      });
    } catch (error) {
      toast({
        title: "Mode Change Failed",
        description: "Failed to change rover mode",
        variant: "destructive"
      });
    }
  }, [setRoverMode, toast]);

  // Emergency stop
  const handleEmergencyStop = useCallback(async () => {
    try {
      await triggerEmergency();
      toast({
        title: "🚨 Emergency Stop",
        description: "Rover has been stopped immediately",
        variant: "destructive"
      });
    } catch (error) {
      console.error('Emergency stop failed:', error);
    }
  }, [triggerEmergency, toast]);

  // Dispatch rover
  const handleDispatch = useCallback(async () => {
    try {
      await dispatchRover('Investigation Site', 'Manual dispatch from console');
      toast({
        title: "🚀 Rover Dispatched",
        description: "Rover is heading to investigation site"
      });
    } catch (error) {
      toast({
        title: "Dispatch Failed",
        description: "Failed to dispatch rover",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Mark as arrived
  const handleMarkArrived = useCallback(async () => {
    try {
      await markRoverArrived();
      toast({
        title: "✅ Rover Arrived",
        description: "Rover has reached the target location"
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update rover status",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Reset mission
  const handleResetMission = useCallback(async () => {
    try {
      await resetMission();
      toast({
        title: "Mission Reset",
        description: "Rover returned to IDLE state"
      });
    } catch (error) {
      toast({
        title: "Emergency Stop Failed",
        description: "Failed to trigger emergency stop",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Keyboard controls (WASD + Arrow Keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'auto') return;

      const key = e.key.toLowerCase();
      
      // Prevent default for arrow keys
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
      }

      // Ignore if already pressed
      if (activeKey === key) return;

      setActiveKey(key);

      switch (key) {
        case 'w':
        case 'arrowup':
          handleMove('forward');
          break;
        case 's':
        case 'arrowdown':
          handleMove('back');
          break;
        case 'a':
        case 'arrowleft':
          handleMove('left');
          break;
        case 'd':
        case 'arrowright':
          handleMove('right');
          break;
        case ' ':
        case 'escape':
          e.preventDefault();
          handleStop();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        setActiveKey(null);
        handleStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, activeKey, handleMove, handleStop]);

  // Update speed in Firebase when slider changes
  useEffect(() => {
    if (currentDirection !== 'stop' && mode === 'manual') {
      setRoverDirection(currentDirection, speed[0]);
    }
  }, [speed]);

  // Show loading state
  if (roverLoading && !roverControl && !roverStatus) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1">
          <LoadingSpinner fullScreen message="Connecting to rover..." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 overflow-auto bg-background">
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-8 py-4">
          <h1 className="text-2xl font-bold">Rover Command Console</h1>
          <p className="text-sm text-muted-foreground">Real-time rover control and monitoring</p>
        </header>

        <div className="p-4 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Left Panel - Live Camera */}
            <div className="lg:col-span-2">
              <SimpleMjpegStream
                streamUrl={`${import.meta.env.VITE_ESP32_BASE_URL || 'http://192.168.137.247:81'}/stream`}
                nodeId="rover-01"
                roverId="rover-01"
                showControls={true}
                onSnapshotSaved={(metadata) => {
                  toast({
                    title: "Snapshot Saved",
                    description: `Captured at ${new Date(metadata.timestamp).toLocaleTimeString()}`,
                  });
                }}
              />
              
              {/* Sensor Dashboard */}
              <div className="mt-4">
                <SensorDashboard />
              </div>
              
              {/* Recent Alerts */}
              <div className="mt-4">
                <RecentAlerts />
              </div>
              
              {/* Rover Status Bar */}
              <Card className="mt-4 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="font-semibold">Location:</span>{" "}
                    <span className="text-muted-foreground">{location}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Battery:</span>{" "}
                    <span className={`font-semibold ${
                      battery > 50 ? 'text-green-500' : battery > 20 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {battery}%
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Rover Status:</span>{" "}
                    <span className={roverOnline ? "text-green-500" : "text-red-500"}>
                      {roverOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Panel - Movement Controls */}
            <div className="space-y-4 sm:space-y-6">
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Movement Controls</h2>
                  {mode === 'auto' && (
                    <div className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded">
                      AUTO MODE
                    </div>
                  )}
                </div>
                
                {/* Direction Pad — HOLD to move, RELEASE to stop */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div></div>
                  <Button 
                    variant={currentDirection === 'forward' ? "default" : "secondary"}
                    size="lg" 
                    className="h-16 select-none touch-none"
                    onPointerDown={() => handleMove('forward')}
                    onPointerUp={() => handleStop()}
                    onPointerLeave={() => handleStop()}
                    disabled={mode === 'auto'}
                  >
                    <ArrowUp className="w-6 h-6" />
                  </Button>
                  <div></div>
                  
                  <Button 
                    variant={currentDirection === 'left' ? "default" : "secondary"}
                    size="lg" 
                    className="h-16 select-none touch-none"
                    onPointerDown={() => handleMove('left')}
                    onPointerUp={() => handleStop()}
                    onPointerLeave={() => handleStop()}
                    disabled={mode === 'auto'}
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="lg" 
                    className="h-16"
                    onClick={handleEmergencyStop}
                    disabled={!roverOnline}
                  >
                    <Square className="w-6 h-6" />
                  </Button>
                  <Button 
                    variant={currentDirection === 'right' ? "default" : "secondary"}
                    size="lg" 
                    className="h-16 select-none touch-none"
                    onPointerDown={() => handleMove('right')}
                    onPointerUp={() => handleStop()}
                    onPointerLeave={() => handleStop()}
                    disabled={mode === 'auto'}
                  >
                    <ArrowRight className="w-6 h-6" />
                  </Button>
                  
                  <div></div>
                  <Button 
                    variant={currentDirection === 'back' ? "default" : "secondary"}
                    size="lg" 
                    className="h-16 select-none touch-none"
                    onPointerDown={() => handleMove('back')}
                    onPointerUp={() => handleStop()}
                    onPointerLeave={() => handleStop()}
                    disabled={mode === 'auto'}
                  >
                    <ArrowDown className="w-6 h-6" />
                  </Button>
                  <div></div>
                </div>

                {/* Current Direction Display */}
                <div className="mb-4 p-3 bg-secondary rounded-lg text-center">
                  <div className="text-xs text-muted-foreground mb-1">Current Direction</div>
                  <div className="text-lg font-bold capitalize">{currentDirection}</div>
                  <div className="text-xs text-muted-foreground">Speed: {currentSpeed}%</div>
                </div>

                {/* Speed Control */}
                <div className="mb-6">
                  <label className="text-sm font-semibold mb-2 block">Speed Control</label>
                  <Slider
                    value={speed}
                    onValueChange={setSpeed}
                    max={100}
                    step={5}
                    className="mb-2"
                    disabled={mode === 'auto' || !roverOnline}
                  />
                  <p className="text-xs text-muted-foreground text-center">{speed[0]}%</p>
                </div>

                {/* Mode Toggle */}
                <div>
                  <label className="text-sm font-semibold mb-2 block">Control Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={mode === "auto" ? "default" : "secondary"}
                      onClick={() => handleModeToggle("auto")}
                      disabled={!roverOnline}
                    >
                      Auto
                    </Button>
                    <Button
                      variant={mode === "manual" ? "default" : "secondary"}
                      onClick={() => handleModeToggle("manual")}
                      disabled={!roverOnline}
                    >
                      Manual
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {mode === 'auto' 
                      ? 'Rover responds to hazard alerts automatically' 
                      : 'You have manual control of the rover'}
                  </p>
                </div>

                <div className="mt-6 p-4 bg-secondary rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Keyboard Controls:</span><br />
                    <span className="font-semibold">W/↑</span> Forward • 
                    <span className="font-semibold"> S/↓</span> Back • 
                    <span className="font-semibold"> A/←</span> Left • 
                    <span className="font-semibold"> D/→</span> Right<br />
                    <span className="font-semibold">Space/Esc</span> Stop
                  </p>
                </div>
              </Card>

              {/* Mission Control */}
              <Card className="p-4 sm:p-6">
                <h2 className="text-lg font-bold mb-4">Mission Control</h2>
                
                {/* Mission Status Display */}
                <div className="mb-4 p-3 bg-secondary rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Status:</span>
                    <span className={`text-sm font-bold ${
                      mission?.state === 'IDLE' ? 'text-muted-foreground' :
                      mission?.state === 'DISPATCHED' || mission?.state === 'EN_ROUTE' ? 'text-primary' :
                      mission?.state === 'ARRIVED' ? 'text-safe' :
                      'text-warning'
                    }`}>
                      {mission?.state || 'IDLE'}
                    </span>
                  </div>
                  {mission?.target && (
                    <div className="text-xs text-muted-foreground">
                      Target: {mission.target}
                    </div>
                  )}
                  {mission?.reason && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Reason: {mission.reason}
                    </div>
                  )}
                </div>

                {/* Mission Control Buttons */}
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleDispatch}
                    disabled={!roverOnline || (mission?.state !== 'IDLE' && mission?.state !== 'COMPLETED')}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Dispatch Rover
                  </Button>

                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={handleMarkArrived}
                    disabled={!roverOnline || (mission?.state !== 'DISPATCHED' && mission?.state !== 'EN_ROUTE')}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Arrived
                  </Button>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleResetMission}
                    disabled={!roverOnline || mission?.state === 'IDLE'}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Reset Mission
                  </Button>
                </div>

                <div className="mt-4 p-3 bg-muted rounded text-xs text-muted-foreground">
                  <p className="font-semibold mb-1">Mission Flow:</p>
                  <p>1. Dispatch → 2. Mark Arrived → 3. Reset</p>
                </div>
              </Card>

              <SavedPaths />

              <Card className="p-4 sm:p-6">
                <h2 className="text-lg font-bold mb-4">Rover Status</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Battery className="w-4 h-4" />
                        Battery
                      </span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          battery > 50 ? 'bg-safe' : battery > 20 ? 'bg-warning' : 'bg-danger'
                        }`} />
                        <span className="font-semibold">{battery}%</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Location
                      </span>
                      <span className="font-semibold">{location}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Connection</span>
                      <span className={`font-semibold ${roverOnline ? 'text-safe' : 'text-danger'}`}>
                        {roverOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">State</span>
                      <span className="font-semibold capitalize">
                        {currentDirection === 'stop' ? 'Idle' : currentDirection}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Mode</span>
                      <span className="font-semibold capitalize">{mode}</span>
                    </div>

                    {roverControl?.emergency && (
                      <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
                        <div className="flex items-center gap-2 text-danger font-bold text-sm">
                          <Square className="w-4 h-4" />
                          EMERGENCY STOP ACTIVE
                        </div>
                      </div>
                    )}
                  </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RoverConsole;
