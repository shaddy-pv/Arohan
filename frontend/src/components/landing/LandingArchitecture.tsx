import { 
  Layers, 
  Cpu, 
  Server, 
  Cloud, 
  Monitor, 
  ArrowDown, 
  ArrowUp,
  Wifi,
  Database,
  Radio,
  Eye,
  ShieldAlert
} from "lucide-react";

export const LandingArchitecture = () => {
  const architectureLayers = [
    {
      id: "application",
      name: "Application Layer",
      color: "border-blue-500/40 bg-blue-500/5",
      badge: "Vite + React 18 + TypeScript",
      icon: Monitor,
      desc: "Operator interface for real-time telemetry, mission control, and automated alerts.",
      modules: [
        { name: "Dashboard Telemetry", tech: "React 18 / Recharts", detail: "Real-time hazard gauges, gas & thermal trend charts" },
        { name: "Rover Control Console", tech: "WebSocket / HTTP", detail: "Directional pads, autonomous mode toggle, emergency stop" },
        { name: "AI Solution Advisory", tech: "Groq AI / LLaMA3", detail: "Contextual incident recommendations and mitigation steps" },
        { name: "Face Recognition UI", tech: "MJPEG Stream Reader", detail: "Live stream display with bounding box overlays" },
      ],
    },
    {
      id: "cloud",
      name: "Cloud / Communication Layer",
      color: "border-amber-500/40 bg-amber-500/5",
      badge: "Firebase Realtime DB + Auth + Twilio",
      icon: Cloud,
      desc: "High-speed real-time datastore synchronizing sensor states, logs, and notification dispatch.",
      modules: [
        { name: "Firebase Realtime DB", tech: "WebSockets / SDK", detail: "Low-latency bidirectional state sync on /ronin path" },
        { name: "Firebase Auth", tech: "JWT / Email-Password", detail: "Role-based operator authentication & security rules" },
        { name: "Twilio Notifications", tech: "REST API", detail: "Automated WhatsApp and Voice call escalation dispatch" },
        { name: "Firebase Storage", tech: "Cloud Storage", detail: "Incident snapshot storage and historical audit media" },
      ],
    },
    {
      id: "processing",
      name: "Processing Layer",
      color: "border-emerald-500/40 bg-emerald-500/5",
      badge: "Python 3.13 + Flask 3.0 + OpenCV 4.12",
      icon: Server,
      desc: "Edge server executing computer vision models, sensor fusion formulas, and stream proxying.",
      modules: [
        { name: "CV Backend Server", tech: "Flask 3.0 (Port 5000)", detail: "Processes ESP32-CAM stream and extracts facial vectors" },
        { name: "Face Recognition", tech: "FaceNet + dlib", detail: "128-dimensional encodings with L2 euclidean distance matching" },
        { name: "Sensor Fusion Engine", tech: "NumPy / Python", detail: "Multi-parameter normalization and weighted hazard scoring" },
        { name: "IoT Dispatch Bridge", tech: "Python Service", detail: "Receives raw hardware sensor frames and updates Firebase" },
      ],
    },
    {
      id: "hardware",
      name: "Hardware Layer",
      color: "border-purple-500/40 bg-purple-500/5",
      badge: "ESP32 + ESP32-CAM + Arduino Mega + Rover",
      icon: Cpu,
      desc: "Physical edge sensors and autonomous mobile rover verification unit deployed in the facility.",
      modules: [
        { name: "ESP32-CAM Module", tech: "AI-Thinker OV2640", detail: "Streams 640x480 MJPEG at 8-10 FPS on port 81" },
        { name: "Mobile Rover Unit", tech: "Arduino + L298N", detail: "Dual DC motors, differential steering, autonomous navigation" },
        { name: "Environmental Sensors", tech: "MQ-2 + MQ-135 + DHT", detail: "Analog & digital pins sampling gas, smoke, temperature, humidity" },
        { name: "Collision Avoidance", tech: "HC-SR04 Ultrasonic", detail: "Obstacle distance detection preventing rover collisions" },
      ],
    },
  ];

  return (
    <section id="architecture" className="py-24 bg-background relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>FULL STACK ARCHITECTURE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            System Architecture
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            AROHAN is structured as a decoupled four-tier architecture designed for low-latency transmission, 
            resilience against network interruptions, and deterministic safety enforcement.
          </p>
        </div>

        {/* 4 Architectural Layers Stack */}
        <div className="space-y-6 relative">
          {architectureLayers.map((layer, index) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.id}
                className={`p-6 sm:p-8 rounded-2xl border ${layer.color} backdrop-blur-sm transition-all hover:border-primary/60`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-background border border-border">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-foreground">{layer.name}</h3>
                      <p className="text-xs text-muted-foreground">{layer.desc}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono-tech px-3 py-1 rounded-full bg-secondary border border-border text-foreground self-start md:self-auto">
                    {layer.badge}
                  </span>
                </div>

                {/* Sub-modules Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {layer.modules.map((mod, mIdx) => (
                    <div
                      key={mIdx}
                      className="p-4 rounded-xl bg-background/70 border border-border/80 flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-[10px] font-mono-tech text-primary uppercase mb-1">
                          {mod.tech}
                        </div>
                        <h4 className="text-sm font-bold text-foreground mb-1.5">{mod.name}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {mod.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vertical Bus Indicator */}
                {index < architectureLayers.length - 1 && (
                  <div className="flex justify-center -mb-9 mt-4 relative z-10">
                    <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground text-xs shadow-md">
                      <ArrowDown className="w-3.5 h-3.5 text-primary" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Real Tech Stack Badges */}
        <div className="mt-12 p-6 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-4 text-xs font-mono-tech text-muted-foreground">
          <span className="text-foreground font-semibold">VERIFIED STACK:</span>
          <span>React 18</span>
          <span>•</span>
          <span>TypeScript</span>
          <span>•</span>
          <span>Tailwind CSS</span>
          <span>•</span>
          <span>Python 3.13</span>
          <span>•</span>
          <span>Flask 3.0</span>
          <span>•</span>
          <span>OpenCV 4.12</span>
          <span>•</span>
          <span>Firebase RTDB</span>
          <span>•</span>
          <span>ESP32 / Arduino Mega</span>
          <span>•</span>
          <span>Twilio API</span>
        </div>
      </div>
    </section>
  );
};
