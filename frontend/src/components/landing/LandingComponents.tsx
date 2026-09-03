import { 
  Wind, 
  Eye, 
  BrainCircuit, 
  LayoutDashboard, 
  BellRing, 
  Bot,
  Layers,
  ArrowUpRight
} from "lucide-react";

export const LandingComponents = () => {
  const componentsList = [
    {
      number: "01",
      title: "Sensing",
      tag: "Hardware Telemetry",
      icon: Wind,
      description: "Environmental and physical sensor array continuously monitoring toxic gases, combustible vapors, ambient temperature drift, and infrared radiation.",
      specs: ["MQ-2 (200-800 PPM)", "MQ-135 (300-1000 PPM)", "DHT11/22", "Flame IR"],
      color: "text-amber-400",
      border: "border-amber-500/20 hover:border-amber-500/50",
    },
    {
      number: "02",
      title: "Vision",
      tag: "Optical Processing",
      icon: Eye,
      description: "ESP32-CAM AI-Thinker optical stream pipeline executing Caffe Res10 SSD face detection and FaceNet 128-dimensional personnel identification.",
      specs: ["VGA 640x480 Stream", "8-10 FPS MJPEG", "CLAHE Enhancement", "IoU Tracking"],
      color: "text-blue-400",
      border: "border-blue-500/20 hover:border-blue-500/50",
    },
    {
      number: "03",
      title: "Intelligence",
      tag: "Sensor Fusion Engine",
      icon: BrainCircuit,
      description: "Deterministic weighted normalization mathematical model fusing multiple physical signals into a composite 0-100 hazard index.",
      specs: ["Weighted Formula", "Clamped Normalization", "Immediate Flame Override", "LLaMA3 Advisory"],
      color: "text-emerald-400",
      border: "border-emerald-500/20 hover:border-emerald-500/50",
    },
    {
      number: "04",
      title: "Monitoring",
      tag: "Mission Control UI",
      icon: LayoutDashboard,
      description: "Mission control command center built with React 18, TypeScript, and Recharts, rendering sub-second telemetry graphs and incident logs.",
      specs: ["Real-time Telemetry", "Dynamic Trend Lines", "Dark Industrial Theme", "Staleness Watchdog"],
      color: "text-cyan-400",
      border: "border-cyan-500/20 hover:border-cyan-500/50",
    },
    {
      number: "05",
      title: "Response",
      tag: "Automated Dispatch",
      icon: BellRing,
      description: "Multi-channel automated escalation system dispatching Twilio WhatsApp notifications, emergency voice calls, and acoustic sirens.",
      specs: ["Twilio WhatsApp API", "Automated Voice Calls", "Audit Log Storage", "Incident Escalation"],
      color: "text-purple-400",
      border: "border-purple-500/20 hover:border-purple-500/50",
    },
    {
      number: "06",
      title: "Autonomous Inspection",
      tag: "Mobile Ground Robotics",
      icon: Bot,
      description: "Arduino Mega / ESP32 powered robotic rover unit dispatched autonomously to verify high-risk incidents without exposing personnel.",
      specs: ["L298N Drive Motor", "Ultrasonic Obstacle Detect", "WiFi Command Bridge", "Manual Override"],
      color: "text-rose-400",
      border: "border-rose-500/20 hover:border-rose-500/50",
    },
  ];

  return (
    <section id="components" className="py-24 bg-background border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>MODULAR ARCHITECTURE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Six Core Project Components
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Each component in AROHAN operates as an independent, testable module interconnected 
            through standard network protocols and real-time datastores.
          </p>
        </div>

        {/* 6 Interactive Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {componentsList.map((comp) => {
            const Icon = comp.icon;
            return (
              <div
                key={comp.number}
                className={`p-6 sm:p-8 rounded-2xl bg-card border ${comp.border} transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between group shadow-lg`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black font-mono-tech text-foreground/40 group-hover:text-primary transition-colors">
                      {comp.number}
                    </span>
                    <div className={`p-2.5 rounded-lg bg-secondary border border-border ${comp.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <span className="text-[10px] font-mono-tech uppercase tracking-wider text-muted-foreground block mb-1">
                    {comp.tag}
                  </span>
                  <h3 className="text-xl font-bold text-foreground mb-3 font-['Poppins']">
                    {comp.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    {comp.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-border/60">
                  <div className="flex flex-wrap gap-1.5">
                    {comp.specs.map((spec, sIdx) => (
                      <span
                        key={sIdx}
                        className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-secondary/80 text-muted-foreground border border-border"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
