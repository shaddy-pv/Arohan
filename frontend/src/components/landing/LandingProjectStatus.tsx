import { 
  GitBranch, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  ShieldCheck, 
  Activity,
  Cpu
} from "lucide-react";
import { PROJECT_METADATA } from "@/config/landingConfig";

export const LandingProjectStatus = () => {
  const verifiedMilestones = [
    {
      title: "Multi-Sensor Fusion Validated",
      status: "Verified",
      detail: "Formulated weighted algorithm combining MQ-2, MQ-135, and DHT readings into unified 0-100 hazard score.",
    },
    {
      title: "Edge Computer Vision Integrated",
      status: "Verified",
      detail: "Flask 3.0 + OpenCV 4.12 server executing FaceNet 128-d recognition over ESP32-CAM MJPEG stream.",
    },
    {
      title: "Robotic Ground Inspection Rover",
      status: "Operational Prototype",
      detail: "Arduino Mega / ESP32 rover chassis with L298N motor driver and ultrasonic collision avoidance.",
    },
    {
      title: "Multi-Channel Automated Alerting",
      status: "Integrated",
      detail: "Twilio WhatsApp and automated voice dispatch service connected to real-time threshold breaches.",
    },
  ];

  return (
    <section id="status" className="py-24 bg-card/20 border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <Activity className="w-3.5 h-3.5" />
            <span>DEVELOPMENT STATUS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Actively Evolving Engineering Project
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            AROHAN is continuously evolving through hardware, software, AI, and open-source development. 
            We maintain an honest engineering roadmap anchored in verified code and physical testing rather than marketing claims.
          </p>
        </div>

        {/* Real Status Banner */}
        <div className="p-6 sm:p-8 rounded-2xl bg-background border border-border mb-8 shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <span className="text-xs font-mono-tech text-muted-foreground uppercase">CURRENT VERSION</span>
              <div className="text-2xl font-bold text-foreground font-mono-tech flex items-center gap-2">
                <span>v{PROJECT_METADATA.version}</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-safe/20 text-safe border border-safe/30 font-normal">
                  Production Ready
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Main branch release</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono-tech text-muted-foreground uppercase">ENGINEERING TEAM</span>
              <div className="text-2xl font-bold text-foreground font-mono-tech">
                {PROJECT_METADATA.team.name}
              </div>
              <p className="text-xs text-muted-foreground">
                Developed by {PROJECT_METADATA.team.lead} &amp; {PROJECT_METADATA.team.coLead}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono-tech text-muted-foreground uppercase">LICENSE &amp; AUDIT</span>
              <div className="text-2xl font-bold text-foreground font-mono-tech">
                MIT License
              </div>
              <p className="text-xs text-muted-foreground">Open-source &amp; publicly inspectable</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono-tech text-muted-foreground uppercase">DATASET PUBLISHED</span>
              <div className="text-2xl font-bold text-primary font-mono-tech">
                HuggingFace
              </div>
              <p className="text-xs text-muted-foreground">Public multi-modal hazard benchmark</p>
            </div>
          </div>
        </div>

        {/* Milestone Verification Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {verifiedMilestones.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-card border border-border/80 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-safe/10 text-safe border border-safe/30">
                    {item.status}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-safe" />
                </div>
                <h4 className="text-sm font-bold text-foreground mb-2">{item.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
