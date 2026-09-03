import { useState } from "react";
import { 
  Radio, 
  Database, 
  Cpu, 
  Search, 
  Gauge, 
  BellRing, 
  Bot, 
  LayoutDashboard,
  ChevronRight,
  ShieldCheck,
  Check
} from "lucide-react";

export const LandingWorkflow = () => {
  const [activeStage, setActiveStage] = useState(0);

  const workflowStages = [
    {
      id: "sensors",
      number: "01",
      title: "Sensors",
      tagline: "Multi-Modal Physical Sensing",
      shortDesc: "MQ2 combustible gas, MQ135 air quality, DHT temperature, Flame IR, and PIR motion nodes gather ambient data.",
      technicalDetails: [
        "MQ-2 analog sampling for combustible gases (200-800 PPM)",
        "MQ-135 electrochemical sensor for airborne pollutants (300-1000 PPM)",
        "DHT11/22 calibrated ambient thermal and humidity reading",
        "Infrared flame sensor detecting 760-1100nm radiation wavelengths"
      ],
      badge: "Edge Hardware",
      icon: Radio,
    },
    {
      id: "collection",
      number: "02",
      title: "Data Collection",
      tagline: "ESP32 IoT & Video Streaming",
      shortDesc: "Microcontrollers sample analog and digital pins, packaging readings into structured telemetry packets.",
      technicalDetails: [
        "ESP32 IoT nodes transmitting JSON packets over WiFi",
        "ESP32-CAM AI-Thinker streaming 640x480 MJPEG at 8-10 FPS on port 81",
        "IoT Dispatch Server bridging hardware packets to cloud real-time datastore",
        "Configurable heartbeat intervals (1s-5s) with staleness watchdog"
      ],
      badge: "Ingestion Layer",
      icon: Database,
    },
    {
      id: "fusion",
      number: "03",
      title: "AI / Sensor Fusion",
      tagline: "Mathematical Normalization",
      shortDesc: "Raw sensor inputs are dynamically normalized into a unified 0-100 scale to remove calibration variance.",
      technicalDetails: [
        "Linear normalization: Norm = 100 * (Rx - Rmin) / (Rmax - Rmin)",
        "Outlier clamping preventing mathematical overflows",
        "Support for analog continuous streams and digital threshold triggers",
        "Low-light CLAHE enhancement for optical stream pre-processing"
      ],
      badge: "Algorithm",
      icon: Cpu,
    },
    {
      id: "hazard-analysis",
      number: "04",
      title: "Hazard Analysis",
      tagline: "Weighted Threat Computation",
      shortDesc: "Multi-parameter fusion formula weights critical sensor inputs: 60% MQ135, 30% MQ2, 10% Temperature.",
      technicalDetails: [
        "Hazard Score = 0.6·norm(MQ135) + 0.3·norm(MQ2) + 0.1·norm(Temp)",
        "Immediate override triggered if flame sensor detects active fire",
        "Res10 SSD 300x300 deep neural network face detection",
        "FaceNet 128-dimensional vector matching against authorized registry"
      ],
      badge: "Intelligence Layer",
      icon: Search,
    },
    {
      id: "severity",
      number: "05",
      title: "Severity Assessment",
      tagline: "Four-Tier Threat Classification",
      shortDesc: "Calculated hazard indices map into calibrated operational safety tiers: SAFE, WARNING, DANGER, CRITICAL.",
      technicalDetails: [
        "0 - 30: SAFE (All ambient metrics within nominal thresholds)",
        "30 - 60: WARNING (Elevated trace gases; preventative monitoring active)",
        "60 - 80: DANGER (Threshold breach; automated alerts prepped)",
        "80 - 100: CRITICAL (Severe hazard; immediate autonomous dispatch)"
      ],
      badge: "Risk Evaluation",
      icon: Gauge,
    },
    {
      id: "alert-decision",
      number: "06",
      title: "Alert / Decision",
      tagline: "Automated Incident Escalation",
      shortDesc: "State machine triggers multi-channel notifications and dispatches emergency alarms.",
      technicalDetails: [
        "Twilio automated WhatsApp notifications with timestamp and hazard level",
        "Automated voice call escalation to facility emergency response managers",
        "Real-time event recorded in Firebase audit log for compliance",
        "Sound and visual alert strobe triggers across web consoles"
      ],
      badge: "Response Layer",
      icon: BellRing,
    },
    {
      id: "inspection",
      number: "07",
      title: "Autonomous Inspection",
      tagline: "Robotic Rover Physical Verification",
      shortDesc: "When severe hazard is flagged, the autonomous rover navigates to ground-zero to verify the situation.",
      technicalDetails: [
        "Arduino Mega controller + L298N dual H-bridge motor driver",
        "Ultrasonic HC-SR04 obstacle detection preventing collisions",
        "ESP32-CAM optical sensor transmits live first-person video stream",
        "Manual teleoperation override available directly from Mission Control"
      ],
      badge: "Robotics Layer",
      icon: Bot,
    },
    {
      id: "dashboard",
      number: "08",
      title: "Dashboard / Response",
      tagline: "Mission Control Telemetry",
      shortDesc: "Operators monitor real-time telemetry, track rover movements, and review AI mitigation recommendations.",
      technicalDetails: [
        "React 18 + TypeScript high-density command center",
        "Recharts live trend lines for gas PPM and thermal drift",
        "Groq AI / LLaMA3-8B incident mitigation action recommendations",
        "Operator intervention controls with role-based safeguards"
      ],
      badge: "Application Layer",
      icon: LayoutDashboard,
    },
  ];

  return (
    <section id="workflow" className="py-24 bg-card/20 border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>END-TO-END WORKFLOW</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            AROHAN operates as a continuous closed-loop pipeline from physical edge sensing 
            to cloud intelligence and autonomous robotic verification.
          </p>
        </div>

        {/* 8-Stage Interactive Engineering Stepper Grid (No ugly horizontal scrollbar) */}
        <div className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 p-1.5 rounded-2xl bg-neutral-950/80 border border-white/10 backdrop-blur-xl shadow-lg">
            {workflowStages.map((stage, idx) => {
              const Icon = stage.icon;
              const isActive = activeStage === idx;
              const isPast = idx < activeStage;
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStage(idx)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all duration-200 group text-center relative ${
                    isActive
                      ? "bg-blue-600 text-white shadow-[0_0_18px_rgba(37,99,235,0.4)] border border-blue-400/40"
                      : isPast
                      ? "bg-white/[0.03] text-neutral-200 hover:bg-white/[0.06] border border-blue-500/20"
                      : "bg-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] font-mono-tech font-bold ${isActive ? "text-blue-100" : isPast ? "text-blue-400" : "text-neutral-500"}`}>
                      {stage.number}
                    </span>
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : isPast ? "text-blue-400" : "text-neutral-400 group-hover:text-neutral-200"}`} />
                  </div>
                  <span className="text-[11px] font-medium leading-tight line-clamp-1">
                    {stage.title}
                  </span>
                  
                  {/* Active bottom glowing beacon pill */}
                  {isActive && (
                    <span className="absolute -bottom-1 w-6 h-1 rounded-full bg-blue-300 shadow-[0_0_8px_#60A5FA]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Continuous Interactive Progress Track (Desktop) */}
          <div className="hidden lg:block relative mt-3 mb-6 mx-3">
            <div className="h-[2px] w-full bg-white/10 rounded-full" />
            <div 
              className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 shadow-[0_0_8px_#3B82F6] rounded-full transition-all duration-300"
              style={{ width: `${((activeStage + 1) / workflowStages.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Detailed Active Stage Spotlight Card */}
        <div className="p-6 sm:p-10 rounded-2xl border border-primary/30 bg-card/60 backdrop-blur-md relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            {(() => {
              const ActiveIcon = workflowStages[activeStage].icon;
              return <ActiveIcon className="w-64 h-64 text-primary" />;
            })()}
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Col: Overview & Badges */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-tech px-2.5 py-1 rounded bg-primary/20 text-primary border border-primary/30">
                  PIPELINE STAGE {workflowStages[activeStage].number} OF 08
                </span>
                <span className="text-xs font-mono-tech px-2.5 py-1 rounded bg-secondary text-muted-foreground border border-border">
                  {workflowStages[activeStage].badge}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-foreground font-['Poppins']">
                {workflowStages[activeStage].title}
              </h3>
              <p className="text-sm font-semibold text-primary">
                {workflowStages[activeStage].tagline}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {workflowStages[activeStage].shortDesc}
              </p>

              {/* Navigation controls for stages */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  disabled={activeStage === 0}
                  onClick={() => setActiveStage(Math.max(0, activeStage - 1))}
                  className="px-3 py-1.5 rounded border border-border text-xs font-mono-tech text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                >
                  ← Previous Stage
                </button>
                <button
                  disabled={activeStage === workflowStages.length - 1}
                  onClick={() => setActiveStage(Math.min(workflowStages.length - 1, activeStage + 1))}
                  className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-mono-tech hover:bg-primary/90 disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next Stage →
                </button>
              </div>
            </div>

            {/* Right Col: Technical Specifications */}
            <div className="lg:col-span-7 bg-background/80 p-6 rounded-xl border border-border/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono-tech text-muted-foreground">
                <span>ENGINEERING SPECIFICATION</span>
                <span>STAGE LOGIC</span>
              </div>

              <div className="space-y-3">
                {workflowStages[activeStage].technicalDetails.map((detail, dIdx) => (
                  <div key={dIdx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 font-mono-tech leading-relaxed">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono-tech text-muted-foreground">
                <span>STATUS: OPERATIONAL</span>
                <span>CODEBASE: /hardware + /backend + /frontend</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
