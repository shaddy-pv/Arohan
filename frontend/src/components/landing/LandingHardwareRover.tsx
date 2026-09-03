import { 
  Bot, 
  Cpu, 
  Camera, 
  Radar, 
  Zap, 
  Navigation, 
  Activity, 
  Eye, 
  ShieldCheck,
  ChevronRight
} from "lucide-react";

export const LandingHardwareRover = () => {
  const roverSpecs = [
    {
      title: "Microcontroller Unit",
      value: "Arduino Mega / ESP32",
      detail: "Handles low-level motor PWM, ultrasonic interrupts, WiFi telemetry, and sensor polling.",
      icon: Cpu,
    },
    {
      title: "Optical Sensor Payload",
      value: "ESP32-CAM (AI-Thinker)",
      detail: "OV2640 camera streaming VGA (640x480) MJPEG video at 8-10 FPS over port 81 for live visual analysis.",
      icon: Camera,
    },
    {
      title: "Drive & Motor System",
      value: "L298N Dual H-Bridge Driver",
      detail: "Powers dual high-torque DC geared motors with differential skid-steering for nimble corridor navigation.",
      icon: Zap,
    },
    {
      title: "Obstacle Avoidance",
      value: "HC-SR04 Ultrasonic Array",
      detail: "Range sensing from 2cm to 400cm; triggers automatic stop/turn upon detecting obstructions under 25cm.",
      icon: Radar,
    },
    {
      title: "Operational Modes",
      value: "Dual Mode: Auto Dispatch / Manual",
      detail: "Dispatches autonomously on critical hazard events; operators can take manual teleoperation control at any time.",
      icon: Navigation,
    },
    {
      title: "Power Architecture",
      value: "Independent Dual-Cell Li-ion",
      detail: "Dedicated isolated power rails for logic microcontrollers and high-draw motor inductive loads.",
      icon: Activity,
    },
  ];

  return (
    <section id="rover" className="py-24 bg-card/20 border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <span>PHYSICAL ROBOTIC PLATFORM</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            From Digital Detection to Physical Inspection
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            When stationary sensors detect hazardous gas spikes, smoke, or elevated heat, dispatching human security 
            or safety technicians into the unverified area poses immediate respiratory and physical risks.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed mt-3">
            AROHAN solves this through an autonomous ground inspection rover. Operating as an expendable, mobile 
            sensor node, the rover navigates to the incident coordinates to stream first-person video and confirm 
            the exact nature of the threat before personnel enter.
          </p>
        </div>

        {/* Technical Schematics & Specifications Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Visual Technical Diagram (CSS/Vector based) */}
          <div className="lg:col-span-5 bg-background p-6 sm:p-8 rounded-2xl border border-border flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
              <div className="flex items-center gap-2 font-mono-tech text-xs text-primary">
                <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
                <span>ROVER TELEMETRY SCHEMATIC</span>
              </div>
              <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                UNIT: AROHAN-RV1
              </span>
            </div>

            {/* Vector Rover Chassis Graphic */}
            <div className="relative my-6 p-6 rounded-xl bg-card border border-border/70 flex flex-col items-center justify-center">
              {/* Camera Mount */}
              <div className="flex flex-col items-center mb-2">
                <div className="px-3 py-1 rounded-md bg-primary/20 border border-primary/40 text-[10px] font-mono-tech text-primary flex items-center gap-1.5 mb-1">
                  <Camera className="w-3 h-3" />
                  <span>ESP32-CAM (OV2640)</span>
                </div>
                <div className="w-0.5 h-3 bg-primary/40" />
              </div>

              {/* Main Chassis Body */}
              <div className="w-48 sm:w-56 h-28 sm:h-32 rounded-xl bg-secondary/80 border-2 border-primary/40 flex flex-col items-center justify-center p-3 relative shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                {/* Wheels Left/Right */}
                <div className="absolute -left-3 top-2 w-2.5 h-10 rounded bg-foreground/30 border border-foreground/40" />
                <div className="absolute -left-3 bottom-2 w-2.5 h-10 rounded bg-foreground/30 border border-foreground/40" />
                <div className="absolute -right-3 top-2 w-2.5 h-10 rounded bg-foreground/30 border border-foreground/40" />
                <div className="absolute -right-3 bottom-2 w-2.5 h-10 rounded bg-foreground/30 border border-foreground/40" />

                <div className="text-center space-y-1">
                  <div className="text-xs font-bold text-foreground font-mono-tech">ARDUINO MEGA / ESP32</div>
                  <div className="text-[10px] text-muted-foreground font-mono-tech">L298N DUAL H-BRIDGE</div>
                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-safe/10 text-safe text-[9px] font-mono-tech border border-safe/20">
                    WIFI TELEMETRY ACTIVE
                  </div>
                </div>
              </div>

              {/* Ultrasonic Sensor Front */}
              <div className="flex flex-col items-center mt-2">
                <div className="w-0.5 h-3 bg-cyan-500/40" />
                <div className="px-3 py-1 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-[10px] font-mono-tech text-cyan-400 flex items-center gap-1.5">
                  <Radar className="w-3 h-3" />
                  <span>HC-SR04 ULTRASONIC RANGE</span>
                </div>
              </div>
            </div>

            {/* Rover Specs Footnote */}
            <div className="mt-4 pt-4 border-t border-border/60 text-xs font-mono-tech text-muted-foreground flex items-center justify-between">
              <span>FIRMWARE: /hardware/rover</span>
              <span className="text-safe">AUTONOMOUS &amp; TELEOP READY</span>
            </div>
          </div>

          {/* 6 Rover Engineering Modules */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roverSpecs.map((spec) => {
              const Icon = spec.icon;
              return (
                <div
                  key={spec.title}
                  className="p-5 rounded-xl bg-card/60 border border-border/80 flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded bg-primary/10 text-primary border border-primary/20">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-mono-tech uppercase text-muted-foreground">
                        {spec.title}
                      </h4>
                    </div>
                    <div className="text-sm font-bold text-foreground mb-1.5 font-mono-tech">
                      {spec.value}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {spec.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
