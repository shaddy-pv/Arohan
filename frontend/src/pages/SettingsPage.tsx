import { Sidebar } from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorState } from "@/components/ErrorState";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Terminal } from "lucide-react";
import { ref, set, update, onValue, off } from "firebase/database";
import { database } from "@/lib/firebase";
import { updateWhatsAppSettings } from "@/lib/firebaseService";

const SettingsPage = () => {
  const { toast } = useToast();
  const { isGuest } = useAuth();
  const { settings, loading } = useSettings();
  const { updateThresholds, updateRoverBehavior, addAlert } = useFirebase();

  // Local state for sliders
  const [gasWarning, setGasWarning] = useState([300]);
  const [gasDanger, setGasDanger] = useState([500]);
  const [tempWarning, setTempWarning] = useState([30]);
  const [tempDanger, setTempDanger] = useState([35]);
  const [hazardThreshold, setHazardThreshold] = useState([60]);
  
  // Rover behavior state
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [dispatchDelay, setDispatchDelay] = useState([10]);
  const [maxInvestigationTime, setMaxInvestigationTime] = useState([15]);
  const [returnToBase, setReturnToBase] = useState(true);

  // WhatsApp notification state
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappRecipient, setWhatsappRecipient] = useState('9555971850');
  const [whatsappMinSeverity, setWhatsappMinSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [whatsappTestLoading, setWhatsappTestLoading] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState<any[]>([]);

  // System info state
  const [systemInfo, setSystemInfo] = useState({
    deviceId: 'AROHAN-UNIT-001',
    roverId: 'ROVER-ALPHA-01',
    firmwareVersion: 'v2.4.1',
    lastSystemCheck: new Date().toISOString()
  });

  // Debounce timers
  const thresholdDebounceRef = useRef<NodeJS.Timeout>();
  const roverDebounceRef = useRef<NodeJS.Timeout>();

  // Load settings from Firebase
  useEffect(() => {
    if (settings) {
      setGasWarning([settings.sensorRanges?.mq2?.max || 500]);
      setGasDanger([settings.sensorRanges?.mq135?.max || 700]);
      setTempWarning([settings.thresholds?.warningMax || 30]);
      setTempDanger([settings.thresholds?.dangerMin || 35]);
      setHazardThreshold([settings.roverBehavior?.autoDispatchThreshold || 60]);
      
      setAutoDispatch(settings.roverBehavior?.autoDispatchEnabled ?? true);
      setDispatchDelay([Math.floor((settings.roverBehavior?.checkDuration || 10) / 1)]);
      setMaxInvestigationTime([Math.floor((settings.roverBehavior?.checkDuration || 300) / 60)]);
      setReturnToBase(settings.roverBehavior?.returnToBaseAfterCheck ?? true);

      // WhatsApp settings
      if (settings.whatsappNotifications) {
        setWhatsappEnabled(settings.whatsappNotifications.enabled ?? true);
        setWhatsappRecipient(settings.whatsappNotifications.recipientNumber || '9555971850');
        setWhatsappMinSeverity(settings.whatsappNotifications.minSeverity || 'low');
      }
    }
  }, [settings]);

  // Subscribe to WhatsApp logs
  useEffect(() => {
    const logsRef = ref(database, 'ronin/whatsapp_logs');
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const logs = Object.entries(val)
          .map(([key, value]: [string, any]) => ({ id: key, ...value }))
          .sort((a: any, b: any) => b.timestamp - a.timestamp)
          .slice(0, 5);
        setWhatsappLogs(logs);
      } else {
        setWhatsappLogs([]);
      }
    });

    return () => off(logsRef);
  }, []);

  // Load system info from Firebase
  useEffect(() => {
    const systemInfoRef = ref(database, 'ronin/systemInfo');
    const unsubscribe = () => {}; // Placeholder for actual listener
    
    // In production, this would be a real-time listener
    // For now, we'll use static data
    
    return unsubscribe;
  }, []);

  // Debounced threshold update
  const updateThresholdsDebounced = useCallback((thresholds: any) => {
    if (thresholdDebounceRef.current) {
      clearTimeout(thresholdDebounceRef.current);
    }

    thresholdDebounceRef.current = setTimeout(async () => {
      try {
        await updateThresholds(thresholds);
        toast({
          title: "Thresholds Updated",
          description: "Alert thresholds have been saved."
        });
      } catch (error) {
        toast({
          title: "Update Failed",
          description: "Failed to update thresholds",
          variant: "destructive"
        });
      }
    }, 1000); // 1 second debounce
  }, [updateThresholds, toast]);

  // Debounced rover behavior update
  const updateRoverBehaviorDebounced = useCallback((behavior: any) => {
    if (roverDebounceRef.current) {
      clearTimeout(roverDebounceRef.current);
    }

    roverDebounceRef.current = setTimeout(async () => {
      try {
        await updateRoverBehavior(behavior);
        toast({
          title: "Rover Behavior Updated",
          description: "Rover settings have been saved."
        });
      } catch (error) {
        toast({
          title: "Update Failed",
          description: "Failed to update rover behavior",
          variant: "destructive"
        });
      }
    }, 1000);
  }, [updateRoverBehavior, toast]);

  // Handle threshold changes
  const handleGasWarningChange = (value: number[]) => {
    setGasWarning(value);
    updateThresholdsDebounced({ warningMax: value[0] });
  };

  const handleGasDangerChange = (value: number[]) => {
    setGasDanger(value);
    updateThresholdsDebounced({ dangerMin: value[0] });
  };

  const handleTempWarningChange = (value: number[]) => {
    setTempWarning(value);
    updateThresholdsDebounced({ warningMax: value[0] });
  };

  const handleTempDangerChange = (value: number[]) => {
    setTempDanger(value);
    updateThresholdsDebounced({ dangerMin: value[0] });
  };

  const handleHazardThresholdChange = (value: number[]) => {
    setHazardThreshold(value);
    updateRoverBehaviorDebounced({ autoDispatchThreshold: value[0] });
  };

  // Handle rover behavior changes
  const handleAutoDispatchChange = async (checked: boolean) => {
    setAutoDispatch(checked);
    try {
      await updateRoverBehavior({ autoDispatchEnabled: checked });
      toast({
        title: checked ? "Auto Dispatch Enabled" : "Auto Dispatch Disabled",
        description: checked 
          ? "Rover will automatically investigate alerts" 
          : "Rover requires manual dispatch"
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update auto dispatch setting",
        variant: "destructive"
      });
    }
  };

  const handleDispatchDelayChange = (value: number[]) => {
    setDispatchDelay(value);
    updateRoverBehaviorDebounced({ dispatchDelay: value[0] });
  };

  const handleMaxInvestigationTimeChange = (value: number[]) => {
    setMaxInvestigationTime(value);
    updateRoverBehaviorDebounced({ checkDuration: value[0] * 60 }); // Convert to seconds
  };

  const handleReturnToBaseChange = async (checked: boolean) => {
    setReturnToBase(checked);
    try {
      await updateRoverBehavior({ returnToBaseAfterCheck: checked });
    } catch (error) {
      console.error('Failed to update return to base setting:', error);
    }
  };

  // WhatsApp notification handlers
  const handleWhatsappEnabledChange = async (checked: boolean) => {
    setWhatsappEnabled(checked);
    try {
      await updateWhatsAppSettings({ enabled: checked });
      toast({
        title: checked ? "📱 WhatsApp Alerts Enabled" : "📵 WhatsApp Alerts Disabled",
        description: checked
          ? "You will receive WhatsApp messages when thresholds are breached"
          : "WhatsApp notifications are now turned off"
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update WhatsApp settings",
        variant: "destructive"
      });
    }
  };

  const handleWhatsappRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setWhatsappRecipient(value);
  };

  const handleWhatsappRecipientSave = async () => {
    if (whatsappRecipient.length !== 10) {
      toast({
        title: "Invalid Number",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive"
      });
      return;
    }
    try {
      await updateWhatsAppSettings({ recipientNumber: whatsappRecipient });
      toast({
        title: "Recipient Updated",
        description: `WhatsApp alerts will be sent to +91${whatsappRecipient}`
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to save recipient number",
        variant: "destructive"
      });
    }
  };

  const handleWhatsappSeverityChange = async (severity: 'low' | 'medium' | 'high' | 'critical') => {
    setWhatsappMinSeverity(severity);
    try {
      await updateWhatsAppSettings({ minSeverity: severity });
      toast({
        title: "Severity Filter Updated",
        description: `Only ${severity}+ severity alerts will trigger WhatsApp`
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update severity filter",
        variant: "destructive"
      });
    }
  };

  const handleSendTestWhatsApp = async () => {
    setWhatsappTestLoading(true);
    try {
      // Call the local CV backend endpoint for testing
      const response = await fetch(
        `${import.meta.env.VITE_CV_BACKEND_URL || 'http://localhost:5000'}/send-test-whatsapp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      const result = await response.json();

      if (result.success) {
        toast({
          title: "✅ Test Message Sent!",
          description: `WhatsApp message delivered (SID: ${result.messageSid?.slice(-8) || 'N/A'})`
        });
      } else {
        toast({
          title: "❌ Test Failed",
          description: result.message || "Could not send test message",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "❌ Connection Failed",
        description: "Could not reach the WhatsApp service. Make sure Cloud Functions are deployed.",
        variant: "destructive"
      });
    } finally {
      setWhatsappTestLoading(false);
    }
  };

  // Simulation functions
  const simulateGasAlert = async () => {
    try {
      await addAlert({
        type: 'Gas Detection',
        severity: 'high',
        summary: '🧪 SIMULATION: Elevated gas levels detected in monitoring zone',
        resolved: false
      });

      // Update hazard score for demo
      const iotRef = ref(database, 'ronin/iot');
      await update(iotRef, {
        mq2: 650,
        mq135: 850,
        hazardScore: 75
      });

      toast({
        title: "🧪 Gas Alert Simulated",
        description: "Test alert created with elevated gas readings",
        variant: "destructive"
      });
    } catch (error) {
      toast({
        title: "Simulation Failed",
        description: "Failed to create test alert",
        variant: "destructive"
      });
    }
  };

  const simulateFireAlert = async () => {
    try {
      await addAlert({
        type: 'Fire Alert',
        severity: 'critical',
        summary: '🧪 SIMULATION: Flame sensor triggered - immediate response required',
        resolved: false
      });

      // Update hazard score for demo
      const iotRef = ref(database, 'ronin/iot');
      await update(iotRef, {
        flame: true,
        temperature: 38,
        hazardScore: 95
      });

      toast({
        title: "🧪 Fire Alert Simulated",
        description: "Test alert created with fire detection",
        variant: "destructive"
      });
    } catch (error) {
      toast({
        title: "Simulation Failed",
        description: "Failed to create test alert",
        variant: "destructive"
      });
    }
  };

  const resetToFactory = async () => {
    try {
      const defaultSettings = {
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
          checkDuration: 300
        },
        whatsappNotifications: {
          enabled: true,
          recipientNumber: '9555971850',
          minSeverity: 'low'
        }
      };

      const settingsRef = ref(database, 'ronin/settings');
      await set(settingsRef, defaultSettings);

      toast({
        title: "Settings Reset",
        description: "All settings have been reset to factory defaults"
      });
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: "Failed to reset settings",
        variant: "destructive"
      });
    }
  };

  // Show loading state
  if (loading && !settings) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1">
          <LoadingSpinner fullScreen message="Loading settings..." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-8 py-4">
          <h1 className="text-xl sm:text-2xl font-bold">System Settings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Configure thresholds and system behavior</p>
        </header>

        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* Guest Mode Restriction Notice */}
          {isGuest && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-400">
              <Terminal className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold font-mono-tech">Settings Restricted in Guest Mode</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  You are exploring AROHAN in read-only Guest Mode. Modifications to threshold sliders, rover dispatch rules, and emergency WhatsApp recipient numbers are disabled. Sign in with an operator account to save custom configurations.
                </p>
              </div>
            </div>
          )}

          {/* Threshold Settings */}
          <Card className="p-4 sm:p-6">
            <h2 className="text-lg font-bold mb-4 sm:mb-6">Alert Thresholds</h2>
            
            <div className="space-y-4 sm:space-y-6">
                <div>
                  <Label className="mb-2 block">Gas Warning Level (MQ-2)</Label>
                  <Slider
                    value={gasWarning}
                    onValueChange={handleGasWarningChange}
                    max={1000}
                    step={10}
                    className="mb-2"
                  />
                  <p className="text-sm text-muted-foreground">{gasWarning[0]} PPM</p>
                </div>

                <div>
                  <Label className="mb-2 block">Gas Danger Level (MQ-135)</Label>
                  <Slider
                    value={gasDanger}
                    onValueChange={handleGasDangerChange}
                    max={1000}
                    step={10}
                    className="mb-2"
                  />
                  <p className="text-sm text-muted-foreground">{gasDanger[0]} PPM</p>
                </div>

                <div>
                  <Label className="mb-2 block">Temperature Warning Level</Label>
                  <Slider
                    value={tempWarning}
                    onValueChange={handleTempWarningChange}
                    max={50}
                    step={1}
                    className="mb-2"
                  />
                  <p className="text-sm text-muted-foreground">{tempWarning[0]}°C</p>
                </div>

                <div>
                  <Label className="mb-2 block">Temperature Danger Level</Label>
                  <Slider
                    value={tempDanger}
                    onValueChange={handleTempDangerChange}
                    max={50}
                    step={1}
                    className="mb-2"
                  />
                  <p className="text-sm text-muted-foreground">{tempDanger[0]}°C</p>
                </div>

                <div>
                  <Label className="mb-2 block">Hazard Score Auto-Dispatch Threshold</Label>
                  <Slider
                    value={hazardThreshold}
                    onValueChange={handleHazardThresholdChange}
                    max={100}
                    step={5}
                    className="mb-2"
                  />
                  <p className="text-sm text-muted-foreground">
                    {hazardThreshold[0]}/100 - Rover dispatches when hazard score exceeds this value
                  </p>
                </div>
              </div>
          </Card>

          {/* Rover Behavior */}
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-6">Rover Behavior</h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div>
                  <Label>Auto Dispatch on Alert</Label>
                  <p className="text-sm text-muted-foreground">Automatically send rover to investigate alerts</p>
                </div>
                <Switch checked={autoDispatch} onCheckedChange={handleAutoDispatchChange} />
              </div>

              <div>
                <Label className="mb-2 block">Dispatch Delay (seconds)</Label>
                <Slider 
                  value={dispatchDelay}
                  onValueChange={handleDispatchDelayChange}
                  max={60} 
                  step={5}
                  className="mb-2"
                />
                <p className="text-sm text-muted-foreground">
                  {dispatchDelay[0]}s - Wait time before dispatching rover
                </p>
              </div>

              <div>
                <Label className="mb-2 block">Max Investigation Time (minutes)</Label>
                <Slider 
                  value={maxInvestigationTime}
                  onValueChange={handleMaxInvestigationTimeChange}
                  max={60} 
                  step={5}
                  className="mb-2"
                />
                <p className="text-sm text-muted-foreground">
                  {maxInvestigationTime[0]} min - Maximum time for rover investigation
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div>
                  <Label>Return to Base After Check</Label>
                  <p className="text-sm text-muted-foreground">Rover returns to base after investigation</p>
                </div>
                <Switch checked={returnToBase} onCheckedChange={handleReturnToBaseChange} />
              </div>
            </div>
          </Card>

          {/* WhatsApp Notifications */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <span className="text-2xl">📱</span>
              <h2 className="text-lg font-bold">WhatsApp Notifications</h2>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div>
                  <Label>Enable WhatsApp Alerts</Label>
                  <p className="text-sm text-muted-foreground">Send threshold alerts via WhatsApp (Twilio)</p>
                </div>
                <Switch checked={whatsappEnabled} onCheckedChange={handleWhatsappEnabledChange} />
              </div>

              {/* Recipient Number */}
              <div>
                <Label className="mb-2 block">Recipient Phone Number</Label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 px-3 bg-secondary rounded-lg text-sm text-muted-foreground">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={whatsappRecipient}
                    onChange={handleWhatsappRecipientChange}
                    placeholder="Enter 10-digit number"
                    className="flex-1 px-3 py-2 bg-secondary rounded-lg text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    maxLength={10}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleWhatsappRecipientSave}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  WhatsApp number that will receive safety alerts
                </p>
              </div>

              {/* Minimum Severity */}
              <div>
                <Label className="mb-2 block">Minimum Severity for WhatsApp</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map((severity) => {
                    const emoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
                    const isSelected = whatsappMinSeverity === severity;
                    return (
                      <button
                        key={severity}
                        onClick={() => handleWhatsappSeverityChange(severity)}
                        className={`p-2 rounded-lg text-xs font-medium text-center transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                            : 'bg-secondary hover:bg-secondary/80'
                        }`}
                      >
                        {emoji[severity]} {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Only alerts at or above this severity will trigger WhatsApp messages
                </p>
              </div>

              {/* Test Message */}
              <div className="pt-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleSendTestWhatsApp}
                  disabled={whatsappTestLoading || !whatsappEnabled}
                >
                  {whatsappTestLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span> Sending...
                    </span>
                  ) : (
                    '📤 Send Test WhatsApp Message'
                  )}
                </Button>
              </div>

              {/* Recent WhatsApp Logs */}
              {whatsappLogs.length > 0 && (
                <div className="pt-2">
                  <Label className="mb-2 block text-xs">Recent WhatsApp Messages</Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {whatsappLogs.map((log: any) => (
                      <div key={log.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded text-xs">
                        <div className="flex items-center gap-2">
                          <span>{log.status === 'failed' ? '❌' : '✅'}</span>
                          <span className="font-medium">{log.alertType}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* System Info */}
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-6">System Information</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Device ID</span>
                <span className="text-sm font-mono">{systemInfo.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Rover ID</span>
                <span className="text-sm font-mono">{systemInfo.roverId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Firmware Version</span>
                <span className="text-sm font-mono">{systemInfo.firmwareVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last System Check</span>
                <span className="text-sm">
                  {new Date(systemInfo.lastSystemCheck).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold mb-3">Testing & Simulation</h3>
              <div className="space-y-2">
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={simulateGasAlert}
                >
                  🧪 Simulate Gas Alert
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={simulateFireAlert}
                >
                  🧪 Simulate Fire Alert
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Simulation creates test alerts and updates sensor readings for demo purposes
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-semibold mb-3 text-danger">Danger Zone</h3>
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={resetToFactory}
              >
                Reset to Factory Settings
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will reset all thresholds and rover behavior to default values
              </p>
            </div>
          </Card>

          <div className="flex justify-end gap-4">
            <p className="text-sm text-muted-foreground flex items-center">
              Settings auto-save as you adjust them
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
