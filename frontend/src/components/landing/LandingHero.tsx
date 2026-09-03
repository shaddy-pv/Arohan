import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Play, 
  ArrowRight, 
  Wind, 
  Cpu, 
  BrainCircuit, 
  Flame, 
  BellRing, 
  Bot, 
  Terminal,
  Activity,
  Compass
} from "lucide-react";

export const LandingHero = () => {
  const { currentUser, isGuest, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const handleGuestEntry = () => {
    continueAsGuest();
    navigate("/dashboard");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // 6 Actual Pipeline Stages
  const pipelineStages = [
    {
      step: "01",
      name: "SENSORS",
      detail: "MQ-2 · MQ-135 · DHT · Flame",
      tag: "INPUT",
      icon: Wind,
    },
    {
      step: "02",
      name: "DATA / EDGE",
      detail: "ESP32 ADC & Buffer",
      tag: "INGEST",
      icon: Cpu,
    },
    {
      step: "03",
      name: "AI ANALYSIS",
      detail: "Multi-Sensor Fusion Model",
      tag: "MODEL",
      icon: BrainCircuit,
    },
    {
      step: "04",
      name: "HAZARD DETECTION",
      detail: "Dynamic Severity Score (0–100)",
      tag: "SCORE",
      icon: Flame,
    },
    {
      step: "05",
      name: "ALERT / DECISION",
      detail: "Twilio WhatsApp & Siren Relay",
      tag: "DISPATCH",
      icon: BellRing,
    },
    {
      step: "06",
      name: "AUTONOMOUS ROVER",
      detail: "Mobile Ground Probe",
      tag: "VERIFY",
      icon: Bot,
    },
  ];

  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-20 pb-12 sm:pt-24 sm:pb-16 overflow-hidden bg-neutral-950">
      {/* Subtle, soft feathered grid background */}
      <div className="absolute inset-0 bg-subtle-grid pointer-events-none opacity-80" />

      {/* Subtle top technical ambient glow with restrained blue hint */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[420px] pointer-events-none opacity-20"
        style={{
          background: "radial-gradient(50% 50% at 50% 0%, rgba(37, 99, 235, 0.18) 0%, transparent 100%)"
        }}
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        {/* Two-Column Desktop Grid: Left Hero Content (7 cols) + Right Pipeline (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: Clean Hero Content */}
          <div className="lg:col-span-7 text-left">
            {/* Restrained Status Pill with Technical Blue Accent */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1 rounded-full border border-blue-500/25 bg-blue-950/20 text-blue-300 text-xs font-mono-tech mb-6 shadow-sm backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3B82F6] animate-pulse" />
              <span className="text-neutral-300">Autonomous Safety &amp; Hazard Monitoring Ecosystem</span>
              <span className="text-white/20">•</span>
              <span className="text-blue-400 font-semibold">v2.0 Production</span>
            </div>

            {/* Hero Title: Large, Bold, Clean White Focal Point */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight text-white mb-4 font-['Poppins']">
              AROHAN
            </h1>

            {/* Subtitle: High Legibility with Subtle AROHAN Blue Accent */}
            <p className="text-xl sm:text-2xl lg:text-2xl xl:text-3xl font-medium tracking-tight text-neutral-200 mb-5 leading-snug">
              Autonomous Safety <span className="text-neutral-500">&amp;</span>{" "}
              <span className="text-blue-400 font-semibold">Hazard Monitoring System</span>
            </p>

            {/* Concise Engineering Rationale */}
            <p className="text-sm sm:text-base text-neutral-400 max-w-xl leading-relaxed mb-8 font-normal">
              An AI and IoT-powered safety system that continuously monitors environments, detects potential hazards, 
              analyzes their severity, and enables intelligent response and autonomous inspection.
            </p>

            {/* Clear Three-Tier CTA Hierarchy */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8">
              {/* Primary CTA: AROHAN Blue Accent */}
              {currentUser || isGuest ? (
                <Link to="/dashboard">
                  <Button 
                    size="lg" 
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm h-11 px-7 rounded-xl font-medium shadow-[0_0_20px_rgba(37,99,235,0.35)] transition-all border border-blue-400/30"
                  >
                    <Activity className="w-4 h-4 mr-2 text-blue-200" />
                    Open Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  onClick={handleGuestEntry}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm h-11 px-7 rounded-xl font-medium shadow-[0_0_20px_rgba(37,99,235,0.35)] transition-all border border-blue-400/30"
                >
                  <Terminal className="w-4 h-4 mr-2 text-blue-200" />
                  Open Dashboard (Guest)
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {/* Secondary CTA: Dark/Neutral with Subtle Blue Hover Border */}
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToSection("overview")}
                className="border-white/15 bg-white/[0.03] text-neutral-200 hover:bg-white/[0.08] hover:border-blue-500/40 hover:text-white text-sm h-11 px-6 rounded-xl font-medium transition-all"
              >
                <Compass className="w-4 h-4 mr-2 text-blue-400" />
                Explore System
              </Button>

              {/* Tertiary CTA: Lightweight & Unobtrusive */}
              <Button
                size="lg"
                variant="ghost"
                onClick={() => scrollToSection("demo")}
                className="text-neutral-400 hover:text-white hover:bg-white/[0.05] text-sm h-11 px-4 rounded-xl font-medium transition-all"
              >
                <Play className="w-3.5 h-3.5 mr-2 text-neutral-400 fill-neutral-400" />
                Watch Demo
              </Button>
            </div>

            {/* Subtle Telemetry Strip */}
            <div className="flex items-center gap-3 text-[11px] font-mono-tech text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3B82F6] animate-pulse" /> 
                TELEMETRY: <span className="text-blue-400 font-semibold">NOMINAL</span>
              </span>
              <span className="text-white/15">•</span>
              <span>LOOP LATENCY &lt;500ms</span>
              <span className="text-white/15">•</span>
              <span className="text-neutral-300">ROVER READY</span>
            </div>
          </div>

          {/* RIGHT COLUMN: Compact Vertical "SYSTEM PIPELINE" with Animated Blue Signal */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-neutral-950/70 backdrop-blur-xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_#3B82F6]" />
                  <span className="text-[11px] font-mono-tech uppercase tracking-wider text-neutral-200 font-semibold">
                    SYSTEM PIPELINE
                  </span>
                </div>
                <span className="text-[10px] font-mono-tech text-blue-400/90 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/25">
                  CLOSED-LOOP
                </span>
              </div>

              {/* Vertical Workflow with Continuous Thin Technical Line & Traveling Blue Signal */}
              <div className="relative">
                {/* Vertical Circuit Track: Exactly aligned with the node centers (left-[22px]) */}
                <div className="absolute left-[22px] top-[22px] bottom-[22px] w-[2px] -translate-x-1/2 z-0 pointer-events-none">
                  {/* Base Track Line */}
                  <div className="w-full h-full bg-white/10 rounded-full" />

                  {/* Highlighted Traveled Path Line (glows in AROHAN blue as signal advances) */}
                  <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-blue-600 via-blue-500 to-blue-400 shadow-[0_0_8px_#3B82F6] rounded-full animate-path-fill" />

                  {/* Moving AROHAN-Blue Signal Dot (slower 8s cycle, 100% centered on the line) */}
                  <div 
                    className="absolute left-1/2 w-3 h-3 rounded-full bg-blue-400 border border-white shadow-[0_0_12px_#3B82F6,0_0_20px_#2563EB] animate-signal-travel z-20 pointer-events-none" 
                    title="Active Pipeline Signal"
                  />
                </div>

                {/* 6 Stage Rows */}
                <div className="space-y-2 relative z-10">
                  {pipelineStages.map((stage, idx) => {
                    const Icon = stage.icon;
                    return (
                      <div
                        key={stage.step}
                        className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-950/15 transition-all duration-200 group text-left"
                      >
                        {/* Stage Node Dot on top of the line: Highlights when the signal dot crosses */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border relative z-10 font-mono-tech text-[10px] font-semibold animate-stage-node-${idx + 1}`}>
                          {stage.step}
                        </div>

                        {/* Stage Details */}
                        <div className="flex-grow min-w-0 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-blue-400/90 shrink-0" />
                              <span className="text-xs font-semibold text-neutral-200 group-hover:text-white tracking-wide truncate">
                                {stage.name}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono-tech text-neutral-500 group-hover:text-neutral-400 truncate">
                              {stage.detail}
                            </p>
                          </div>

                          {/* Technical Tag */}
                          <span className="text-[9px] font-mono-tech text-neutral-500 group-hover:text-blue-400/90 px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/5 shrink-0">
                            {stage.tag}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Footer Note */}
              <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono-tech text-neutral-500">
                <span>ADC → FUSION → ACTUATE</span>
                <span className="text-blue-400/90 font-medium">CYCLE: ~500ms</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
