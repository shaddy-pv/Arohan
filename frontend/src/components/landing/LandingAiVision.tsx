import { 
  BrainCircuit, 
  Eye, 
  Sliders, 
  ShieldCheck, 
  Activity, 
  Sparkles,
  Search,
  Code
} from "lucide-react";

export const LandingAiVision = () => {
  const fusionFormulas = [
    {
      symbol: "0.60 × MQ135_norm",
      sensor: "Air Quality / Toxic Gas Index",
      rationale: "Given high toxicity of ammonia, NOx, and benzene in enclosed areas, air quality degradation is weighted at 60%.",
      color: "text-emerald-400",
    },
    {
      symbol: "0.30 × MQ2_norm",
      sensor: "Combustible Gas / Smoke",
      rationale: "Combustible hydrocarbon gases (LPG, propane, methane, hydrogen) and thick smoke represent 30% of baseline risk.",
      color: "text-amber-400",
    },
    {
      symbol: "0.10 × Temp_norm",
      sensor: "Thermal Divergence",
      rationale: "Ambient temperature drift contributes 10% under baseline, but triggers exponential acceleration if coupled with smoke.",
      color: "text-orange-400",
    },
  ];

  const cvCapabilities = [
    {
      title: "Res10 SSD Deep Face Detection",
      detail: "Single Shot MultiBox Detector (300x300 resolution) with Caffe framework backbone, with automated Haar cascade fallback for edge resilience.",
    },
    {
      title: "FaceNet 128-Dimensional Embeddings",
      detail: "Generates 128-d euclidean vector embeddings to verify recognized facility personnel vs. unidentified intruders during alerts.",
    },
    {
      title: "Adaptive Low-Light CLAHE Enhancement",
      detail: "Contrast Limited Adaptive Histogram Equalization + gamma correction for processing noisy camera feeds in smoke or dimmed zones.",
    },
    {
      title: "IoU Multi-Frame Majority Voting",
      detail: "Intersection-over-Union tracking across a 5-frame sliding window eliminates single-frame optical jitter and false-positive face matches.",
    },
  ];

  return (
    <section id="ai-vision" className="py-24 bg-background border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>THE INTELLIGENCE ENGINE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            AI + Computer Vision Architecture
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Single-sensor alarms suffer from false triggers: a dust puff triggers a standard optical detector, 
            or ambient kitchen vapors trigger a simple gas sensor. AROHAN achieves high reliability by fusing 
            multiple physical telemetry signals and cross-verifying them against edge computer vision models.
          </p>
        </div>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sensor Fusion Formula Card */}
          <div className="lg:col-span-6 p-6 sm:p-8 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
                <div className="flex items-center gap-2 text-foreground font-bold">
                  <Sliders className="w-5 h-5 text-primary" />
                  <span>Mathematical Sensor Fusion Model</span>
                </div>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  ALGORITHM
                </span>
              </div>

              {/* Equation Box */}
              <div className="p-4 rounded-xl bg-background border border-primary/30 text-center mb-6 shadow-inner font-mono-tech">
                <span className="text-xs text-muted-foreground block mb-1">HAZARD SCORE FORMULA (0 - 100)</span>
                <div className="text-base sm:text-lg font-bold text-primary tracking-wide">
                  H = (0.60 · N_MQ135) + (0.30 · N_MQ2) + (0.10 · N_Temp)
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  Where N_x = 100 × (R_x - R_min) / (R_max - R_min)
                </div>
              </div>

              {/* Weighted Breakdown List */}
              <div className="space-y-4">
                {fusionFormulas.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-secondary/50 border border-border/70">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold font-mono-tech ${item.color}`}>
                        {item.symbol}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono-tech">
                        {item.sensor}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60 text-xs font-mono-tech text-muted-foreground flex items-center justify-between">
              <span>OVERRIDE CONDITION:</span>
              <span className="text-destructive font-bold">FLAME SENSOR = 1 → H = 100 (CRITICAL)</span>
            </div>
          </div>

          {/* Computer Vision Pipeline Card */}
          <div className="lg:col-span-6 p-6 sm:p-8 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
                <div className="flex items-center gap-2 text-foreground font-bold">
                  <Eye className="w-5 h-5 text-primary" />
                  <span>Computer Vision &amp; Facial Recognition</span>
                </div>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  PORT 5000 / FLASK
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
                The Python Flask CV backend consumes the raw ESP32-CAM stream, executing neural face detection, 
                facial vector matching, and incident verification before rendering annotated video to the frontend.
              </p>

              <div className="space-y-4">
                {cvCapabilities.map((cap, cIdx) => (
                  <div key={cIdx} className="p-3.5 rounded-lg bg-secondary/50 border border-border/70">
                    <h4 className="text-xs font-bold text-foreground font-mono-tech mb-1">
                      {cap.title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cap.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60 text-xs font-mono-tech text-muted-foreground flex items-center justify-between">
              <span>TRAINING DATASET:</span>
              <span className="text-primary font-bold">HUGGINGFACE / AROHAN-DATASET</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
