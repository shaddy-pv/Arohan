import { 
  Flame, 
  Wind, 
  Thermometer, 
  Activity, 
  Eye, 
  AlertTriangle, 
  Bot,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";

export const LandingWhatIs = () => {
  const capabilities = [
    {
      icon: Flame,
      name: "Fire Detection",
      badge: "Optical IR & Thermal",
      description: "Flame radiation sensors coupled with rapid temperature divergence analysis detect ignition events in under 2 seconds.",
      metric: "760nm - 1100nm IR",
      color: "text-red-500",
      border: "border-red-500/20 hover:border-red-500/50",
      bg: "bg-red-500/5",
    },
    {
      icon: Wind,
      name: "Smoke / Gas Detection",
      badge: "MQ-2 Electrochemical",
      description: "Continuously tracks flammable hydrocarbon gases, LPG, propane, methane, hydrogen, and combustible smoke particles.",
      metric: "200 - 800 PPM Range",
      color: "text-amber-500",
      border: "border-amber-500/20 hover:border-amber-500/50",
      bg: "bg-amber-500/5",
    },
    {
      icon: Thermometer,
      name: "Thermal Anomalies",
      badge: "DHT Ambient Sensing",
      description: "Calibrated ambient temperature and humidity tracking for early detection of overheating equipment or thermal runaways.",
      metric: "±0.5°C Resolution",
      color: "text-orange-500",
      border: "border-orange-500/20 hover:border-orange-500/50",
      bg: "bg-orange-500/5",
    },
    {
      icon: Activity,
      name: "Air Quality (PPM)",
      badge: "MQ-135 Gas Matrix",
      description: "Monitors toxic indoor air pollution including ammonia (NH3), nitric oxide (NOx), benzene, and dense smoke emissions.",
      metric: "300 - 1000 PPM Range",
      color: "text-emerald-500",
      border: "border-emerald-500/20 hover:border-emerald-500/50",
      bg: "bg-emerald-500/5",
    },
    {
      icon: Eye,
      name: "Visual Hazards & Faces",
      badge: "ESP32-CAM + OpenCV",
      description: "Continuous 8-10 FPS optical analysis for facial recognition of authorized personnel, intruder detection, and visual incident confirmation.",
      metric: "128-d FaceNet Embeddings",
      color: "text-blue-500",
      border: "border-blue-500/20 hover:border-blue-500/50",
      bg: "bg-blue-500/5",
    },
    {
      icon: AlertTriangle,
      name: "Emergency Conditions",
      badge: "Automated Dispatch",
      description: "Multi-tier alert generation with automated Twilio integration sending instant WhatsApp notifications and voice call triggers.",
      metric: "Sub-Second Alerting",
      color: "text-purple-500",
      border: "border-purple-500/20 hover:border-purple-500/50",
      bg: "bg-purple-500/5",
    },
    {
      icon: Bot,
      name: "Autonomous Inspection",
      badge: "Arduino Ground Rover",
      description: "Mobile robotic inspection platform dispatched autonomously to ground-zero coordinates for close-range visual verification.",
      metric: "Dual Auto / Manual Teleop",
      color: "text-cyan-500",
      border: "border-cyan-500/20 hover:border-cyan-500/50",
      bg: "bg-cyan-500/5",
    },
  ];

  return (
    <section id="overview" className="py-16 sm:py-20 bg-card/30 border-t border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CORE SYSTEM CAPABILITIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            What is AROHAN?
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            AROHAN is an engineering ecosystem designed for real-world safety monitoring. In industrial plants, 
            chemical facilities, research laboratories, and remote campuses, hazardous environments require 
            uninterrupted vigilance—yet human intervention during emergencies can be delayed, disoriented, or physically dangerous.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed mt-3">
            AROHAN bridges digital detection and physical response by fusing stationary IoT sensor clusters, 
            edge computer vision, automated severity scoring, and a mobile robotic rover unit into a unified, 
            intelligent platform.
          </p>
        </div>

        {/* 7 Engineering Capability Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.name}
                className={`p-6 rounded-xl border ${cap.border} ${cap.bg} backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-lg bg-background/80 border border-border/60 ${cap.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                      {cap.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground mb-2">{cap.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {cap.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] font-mono-tech text-muted-foreground">
                  <span>SPECIFICATION:</span>
                  <span className="text-foreground font-semibold">{cap.metric}</span>
                </div>
              </div>
            );
          })}

          {/* Integrated Architecture Summary Card */}
          <div className="p-6 rounded-xl border border-primary/30 bg-primary/5 flex flex-col justify-between lg:col-span-2 xl:col-span-1">
            <div>
              <div className="flex items-center gap-2 text-primary font-mono-tech text-xs mb-3">
                <CheckCircle2 className="w-4 h-4" />
                <span>INTEGRATED SYSTEM</span>
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">Single Operational Picture</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                All 7 sub-systems report synchronously to the AROHAN centralized controller, ensuring 
                zero fragmented dashboards and eliminating false alarm blind spots.
              </p>
            </div>
            <div className="text-[11px] font-mono-tech text-primary/80">
              ✓ Edge + Cloud Synchronization
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
