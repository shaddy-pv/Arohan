import { Button } from "@/components/ui/button";
import { 
  Github, 
  GitPullRequest, 
  Code2, 
  Terminal, 
  Layers, 
  ArrowRight,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { PROJECT_METADATA } from "@/config/landingConfig";

export const LandingOpenSource = () => {
  const contributionTracks = [
    { title: "AI & ML", detail: "Enhance multi-sensor fusion models, anomaly forecasting, and classification heuristics." },
    { title: "Computer Vision", detail: "Refine FaceNet embeddings, low-light enhancement, and edge object detection." },
    { title: "IoT & Embedded", detail: "Optimize ESP32-CAM firmware, analog sensor calibration, and sampling rates." },
    { title: "Rover Robotics", detail: "Develop autonomous waypoint navigation, SLAM mapping, and obstacle avoidance." },
    { title: "Frontend UI", detail: "Extend React 18 mission control dashboard, Recharts analytics, and mobile UX." },
    { title: "Backend Services", detail: "Scale Python Flask CV server, Twilio escalation rules, and Firebase cloud bridges." },
    { title: "Testing & CI/CD", detail: "Expand automated unit tests, Vitest suites, and GitHub Actions CI pipelines." },
    { title: "Documentation", detail: "Improve architecture guides, wiring schematics, and developer onboarding tutorials." },
  ];

  return (
    <section id="opensource" className="py-24 bg-background border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <Github className="w-3.5 h-3.5" />
            <span>OPEN SOURCE COLLABORATION</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Built to Be Explored, Improved and Extended
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Safety systems should not be black boxes. AROHAN is open-source under the MIT license, 
            empowering developers, researchers, and safety engineers to audit the code, build custom sensor nodes, 
            and adapt the platform to laboratories, industrial complexes, and campuses.
          </p>
        </div>

        {/* Contribution Tracks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {contributionTracks.map((track, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-card border border-border/70 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2 font-mono-tech text-xs text-primary font-bold">
                <Code2 className="w-3.5 h-3.5" />
                <span>{track.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {track.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Action Banner */}
        <div className="p-8 rounded-2xl bg-card border border-primary/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <h3 className="text-xl font-bold text-foreground mb-1 font-['Poppins']">
              Join the AROHAN Open Source Project
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Fork the repository, explore the documentation, and submit pull requests or feature discussions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={PROJECT_METADATA.links.github}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-foreground text-background hover:bg-foreground/90 text-xs h-10 px-5 shadow-md">
                <Github className="w-4 h-4 mr-2" />
                View on GitHub
                <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-60" />
              </Button>
            </a>

            <a
              href={PROJECT_METADATA.links.contributing}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="border-border text-foreground hover:bg-secondary text-xs h-10 px-5">
                <GitPullRequest className="w-4 h-4 mr-2 text-primary" />
                Contribute to AROHAN
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
