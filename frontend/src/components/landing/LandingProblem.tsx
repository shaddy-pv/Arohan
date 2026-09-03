import { XCircle, CheckCircle2, ArrowRight, ShieldAlert, Cpu } from "lucide-react";

export const LandingProblem = () => {
  const comparisons = [
    {
      aspect: "Monitoring Continuity",
      traditional: "Human-dependent patrols with periodic manual inspections leaving dangerous temporal blind spots.",
      arohan: "Continuous 24/7 automated telemetry with sub-second polling across all environmental and optical nodes.",
    },
    {
      aspect: "Incident Verification",
      traditional: "Alarms trigger without context; verification requires personnel to physically enter potentially hazardous areas.",
      arohan: "Multi-sensor cross-validation filters noise, followed by autonomous rover dispatch for remote visual confirmation.",
    },
    {
      aspect: "Sensor Architecture",
      traditional: "Siloed smoke detectors, isolated thermostats, and unlinked cameras reporting to separate panels.",
      arohan: "Unified multi-modal sensor fusion model combining combustible gas, air quality, thermal, and optical streams.",
    },
    {
      aspect: "Inspection in Hazard Zones",
      traditional: "Manual physical walk-ins during suspected gas leaks or fires, exposing human operators to acute danger.",
      arohan: "Robotic ground inspection via autonomous rover equipped with camera streaming and obstacle avoidance.",
    },
    {
      aspect: "Situational Awareness",
      traditional: "Binary alarm states (ON/OFF) with zero quantitative severity grading or predictive trend insights.",
      arohan: "Continuous mathematical hazard scoring (0-100) with historical trend analysis and AI mitigation advice.",
    },
  ];

  return (
    <section id="problem" className="py-24 relative overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary text-muted-foreground text-xs font-mono-tech mb-4">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <span>THE ENGINEERING CHALLENGE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Why AROHAN?
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Industrial and laboratory safety cannot rely on delayed human verification or fragmented hardware. 
            Here is how AROHAN addresses core engineering shortcomings in conventional safety infrastructure.
          </p>
        </div>

        {/* Side-by-Side Comparison Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Traditional Monitoring Column */}
          <div className="p-6 sm:p-8 rounded-2xl border border-border/80 bg-card/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Traditional Safety Monitoring</h3>
                  <p className="text-xs text-muted-foreground font-mono-tech">REACTIVE &amp; FRAGMENTED</p>
                </div>
              </div>

              <div className="space-y-6">
                {comparisons.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <span className="text-xs font-mono-tech text-muted-foreground/80 uppercase tracking-wide">
                      {item.aspect}
                    </span>
                    <div className="flex items-start gap-2.5">
                      <span className="text-destructive font-bold text-sm mt-0.5">✕</span>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {item.traditional}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-border/50 text-[11px] font-mono-tech text-muted-foreground">
              OUTCOME: High personnel risk, slow response latency, false alarm fatigue
            </div>
          </div>

          {/* AROHAN Platform Column */}
          <div className="p-6 sm:p-8 rounded-2xl border border-primary/40 bg-primary/5 flex flex-col justify-between shadow-[0_0_40px_rgba(59,130,246,0.1)] relative">
            <div className="absolute top-4 right-4 text-[10px] font-mono-tech uppercase px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
              ENGINEERED SOLUTION
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-primary/20">
                <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">AROHAN Ecosystem</h3>
                  <p className="text-xs text-primary font-mono-tech">AUTONOMOUS &amp; MULTI-MODAL</p>
                </div>
              </div>

              <div className="space-y-6">
                {comparisons.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <span className="text-xs font-mono-tech text-primary/80 uppercase tracking-wide">
                      {item.aspect}
                    </span>
                    <div className="flex items-start gap-2.5">
                      <span className="text-safe font-bold text-sm mt-0.5">✓</span>
                      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-medium">
                        {item.arohan}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-primary/20 text-[11px] font-mono-tech text-primary">
              OUTCOME: Real-time awareness, remote physical verification, rapid automated containment
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
