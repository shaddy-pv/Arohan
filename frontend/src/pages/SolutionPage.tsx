import { Sidebar } from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Ruler,
  AlertTriangle, 
  Cpu, 
  Radio, 
  User, 
  Shield,
  Phone,
  Clock,
  XCircle,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';

// TypeScript interfaces
interface SensorData {
  mq2: number;
  mq135: number;
  temperature: number;
  humidity: number;
  flame: boolean;
  motion: boolean;
  hazardScore: number;
  timestamp: number;
}

interface HazardAnalysis {
  hazardLevel: 'SAFE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  detectedChemical: string;
  chemicalFormula: string;
  hazardType: string;
  summary: string;
  immediateRisk: string;
  evacuationRadius: string;
  roverAction: string;
  iotNodeAction: string;
  humanInstructions: string;
  ppeRequired: string[];
  mitigationSteps: string[];
  doNot: string[];
  emergencyContacts: string;
  estimatedResolutionTime: string;
}

const SolutionPage = () => {
  const { toast } = useToast();
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [sensorStatus, setSensorStatus] = useState<'online' | 'offline'>('offline');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<HazardAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to live sensor data from Firebase
  useEffect(() => {
    const sensorRef = ref(database, 'ronin/iot');
    
    const unsubscribe = onValue(sensorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSensorData({
          mq2: data.mq2 || 0,
          mq135: data.mq135 || 0,
          temperature: data.temperature || 0,
          humidity: data.humidity || 0,
          flame: data.flame || false,
          motion: data.motion || false,
          hazardScore: data.hazardScore || 0,
          timestamp: data.status?.lastHeartbeat || Date.now()
        });
        
        const age = Date.now() - (data.status?.lastHeartbeat || 0);
        setSensorStatus(age < 30000 ? 'online' : 'offline');
      } else {
        setSensorStatus('offline');
      }
    });

    return () => unsubscribe();
  }, []);

  // Build prompt from live sensor data
  const buildPrompt = (sensors: SensorData): string => {
    return `Analyze these real-time sensor readings from an AROHAN safety rover deployed at a hazardous location. Based on the values, identify the likely chemical hazard and provide specific mitigation steps.

LIVE SENSOR READINGS:
- MQ-2 Gas Sensor: ${sensors.mq2} ppm
- MQ-135 Air Quality: ${sensors.mq135} ppm
- Temperature: ${sensors.temperature} °C  
- Humidity: ${sensors.humidity} %
- Flame Detected: ${sensors.flame ? 'YES' : 'NO'}
- Motion Detected: ${sensors.motion ? 'YES' : 'NO'}
- Hazard Score: ${sensors.hazardScore}/100
- Reading Time: ${new Date(sensors.timestamp).toLocaleString()}

GAS LEVEL REFERENCE:
- 0-200 ppm     = Safe / Normal
- 200-400 ppm   = Low concern
- 400-700 ppm   = Moderate — investigate
- 700-1000 ppm  = High — hazardous
- 1000+ ppm     = Critical — immediate action

TEMPERATURE REFERENCE:
- Normal indoor: 18-30°C
- Elevated: 30-50°C (possible fire nearby)
- Critical: 50°C+ (fire or explosion risk)

Based on these readings, respond with ONLY this JSON structure (no markdown, no extra text):
{
  "hazardLevel": "SAFE | LOW | MODERATE | HIGH | CRITICAL",
  "detectedChemical": "most likely chemical or 'Unknown Gas' or 'Safe'",
  "chemicalFormula": "e.g. NH3, LPG, CO, Cl2, or N/A",
  "hazardType": "one line description",
  "summary": "2-3 sentences explaining the current situation",
  "immediateRisk": "what could happen if no action taken",
  "evacuationRadius": "recommended safe distance in meters or N/A",
  "roverAction": "specific action for the rover",
  "iotNodeAction": "what IoT sensors/nodes should do",
  "humanInstructions": "step by step what operator must do now",
  "ppeRequired": ["item1", "item2", "item3"],
  "mitigationSteps": ["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ..."],
  "doNot": ["never do this", "avoid this action"],
  "emergencyContacts": "who to call — fire dept, hazmat team, etc",
  "estimatedResolutionTime": "how long to resolve safely"
}`;
  };

  // Call Groq API
  const callGroqAPI = async (sensorData: SensorData): Promise<string> => {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `You are an industrial safety expert AI assistant for the AROHAN Rover system. You analyze real-time sensor data from hazardous locations and provide specific, actionable chemical mitigation guidance. Always respond with valid JSON only — no markdown, no extra text.`
          },
          {
            role: 'user',
            content: buildPrompt(sensorData)
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Groq API call failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  // Main analyze function
  const analyzeHazard = async () => {
    if (!import.meta.env.VITE_GROQ_API_KEY) {
      setError('Groq API key missing. Add VITE_GROQ_API_KEY to .env file.');
      toast({
        title: "Configuration Error",
        description: "Groq API key not found in environment variables",
        variant: "destructive"
      });
      return;
    }

    if (!sensorData) {
      setError('No sensor data. Check IoT connection and Firebase path /ronin/iot');
      toast({
        title: "No Sensor Data",
        description: "Waiting for sensor readings from Firebase",
        variant: "destructive"
      });
      return;
    }

    if (sensorStatus === 'offline') {
      setError('Sensor data is stale (>30s old). Rover may be offline.');
      toast({
        title: "Sensors Offline",
        description: "Cannot analyze - sensor data is outdated",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const rawText = await callGroqAPI(sensorData);
      const parsed: HazardAnalysis = JSON.parse(rawText);
      setAnalysis(parsed);
      
      toast({
        title: "✅ Analysis Complete",
        description: `Hazard Level: ${parsed.hazardLevel}`
      });
    } catch (err: any) {
      let errorMsg = `Analysis failed: ${err.message}`;
      
      if (err.message.includes('401')) {
        errorMsg = 'Invalid Groq API key. Check VITE_GROQ_API_KEY in .env';
      } else if (err.message.includes('429')) {
        errorMsg = 'Rate limit reached. Wait 1 minute and try again.';
      }
      
      setError(errorMsg);
      toast({
        title: "Analysis Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Get hazard level colors
  const getHazardColor = (level: string) => {
    switch (level) {
      case 'SAFE': return 'bg-green-900 border-green-500 text-green-100';
      case 'LOW': return 'bg-yellow-900 border-yellow-500 text-yellow-100';
      case 'MODERATE': return 'bg-orange-900 border-orange-500 text-orange-100';
      case 'HIGH': return 'bg-red-900 border-red-500 text-red-100';
      case 'CRITICAL': return 'bg-red-950 border-red-500 text-red-100 animate-pulse';
      default: return 'bg-secondary border-border';
    }
  };

  // Get sensor status color
  const getSensorValueColor = (value: number, type: 'gas' | 'temp') => {
    if (type === 'gas') {
      if (value < 200) return 'text-green-500';
      if (value < 400) return 'text-yellow-500';
      if (value < 700) return 'text-orange-500';
      if (value < 1000) return 'text-red-500';
      return 'text-red-600 font-bold';
    } else {
      if (value < 30) return 'text-green-500';
      if (value < 50) return 'text-orange-500';
      return 'text-red-500';
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 overflow-auto bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-8 py-4">
          <div>
            <h1 className="text-2xl font-bold">AI Hazard Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Real-time chemical hazard assessment powered by Groq AI
            </p>
          </div>
        </header>

        <div className="p-4 sm:p-8 space-y-6">
          {/* SECTION A: Live Sensor Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Thermometer className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Temperature</div>
                  <div className={`text-xl font-bold ${sensorData ? getSensorValueColor(sensorData.temperature, 'temp') : 'text-muted-foreground'}`}>
                    {sensorData ? `${sensorData.temperature.toFixed(1)}°C` : '--'}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Droplets className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Humidity</div>
                  <div className="text-xl font-bold">
                    {sensorData ? `${sensorData.humidity}%` : '--'}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Wind className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Gas (MQ-2)</div>
                  <div className={`text-xl font-bold ${sensorData ? getSensorValueColor(sensorData.mq2, 'gas') : 'text-muted-foreground'}`}>
                    {sensorData ? `${sensorData.mq2} ppm` : '--'}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${sensorStatus === 'online' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  <Activity className={`w-5 h-5 ${sensorStatus === 'online' ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge variant={sensorStatus === 'online' ? 'default' : 'destructive'} className="mt-1">
                    {sensorStatus === 'online' ? '🟢 LIVE' : '🔴 OFFLINE'}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* SECTION B: Analyze Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={analyzeHazard}
              disabled={loading || sensorStatus === 'offline'}
              className={`gap-2 ${sensorStatus === 'online' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              title={sensorStatus === 'offline' ? 'Sensors are offline - cannot analyze' : 'Analyze current hazard conditions'}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5" />
                   Analyze Hazard Conditions
                </>
              )}
            </Button>
          </div>

          {/* SECTION D: Error State */}
          {error && (
            <Card className="p-6 border-red-500 bg-red-500/10">
              <div className="flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-500 mb-2">Error</h3>
                  <p className="text-sm text-muted-foreground mb-4">{error}</p>
                  <Button variant="outline" size="sm" onClick={analyzeHazard}>
                    Retry Analysis
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* SECTION E: Empty State */}
          {!analysis && !error && !loading && (
            <Card className="p-12">
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Click "Analyze Hazard Conditions" to get AI-powered hazard assessment based on live sensor data from the AROHAN rover system.
                </p>
              </div>
            </Card>
          )}

          {/* SECTION C: Analysis Result */}
          {analysis && (
            <div className="space-y-6">
              {/* 1. HAZARD LEVEL BANNER */}
              <Card className={`p-6 border-2 ${getHazardColor(analysis.hazardLevel)}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <Badge className="mb-2" variant="outline">
                      {analysis.hazardLevel}
                    </Badge>
                    <h2 className="text-2xl font-bold mb-1">
                      {analysis.detectedChemical}
                      {analysis.chemicalFormula !== 'N/A' && (
                        <span className="text-lg ml-2">({analysis.chemicalFormula})</span>
                      )}
                    </h2>
                    <p className="text-sm opacity-90">{analysis.hazardType}</p>
                  </div>
                  {analysis.evacuationRadius !== 'N/A' && (
                    <div className="text-right">
                      <div className="text-xs opacity-75">Evacuation Radius</div>
                      <div className="text-2xl font-bold">{analysis.evacuationRadius}</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* 2. SUMMARY CARD */}
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-3">Situation Summary</h3>
                <p className="text-muted-foreground mb-4">{analysis.summary}</p>
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-red-500 mb-1">Immediate Risk</div>
                      <p className="text-sm text-muted-foreground">{analysis.immediateRisk}</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 3. THREE ACTION CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">🤖 Rover Action</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.roverAction}</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">📡 IoT Action</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.iotNodeAction}</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">👤 Human Instructions</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.humanInstructions}</p>
                </Card>
              </div>

              {/* 4. MITIGATION STEPS */}
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4">Mitigation Steps</h3>
                <div className="space-y-3">
                  {analysis.mitigationSteps.map((step, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-muted-foreground">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 5. PPE REQUIRED */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold">Required PPE</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.ppeRequired.map((item, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {item}
                    </Badge>
                  ))}
                </div>
              </Card>

              {/* 6. DO NOT LIST */}
              <Card className="p-6 border-red-500/20 bg-red-500/5">
                <h3 className="text-lg font-bold mb-4 text-red-500">⚠️ Do NOT</h3>
                <div className="space-y-2">
                  {analysis.doNot.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-red-500/10 rounded-lg">
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 7. EMERGENCY INFO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Phone className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">Emergency Contacts</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.emergencyContacts}</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">Estimated Resolution Time</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{analysis.estimatedResolutionTime}</p>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SolutionPage;
