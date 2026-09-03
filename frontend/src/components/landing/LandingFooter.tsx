import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ShieldAlert, 
  ArrowRight, 
  Github, 
  ExternalLink, 
  Terminal, 
  Activity,
  Heart
} from "lucide-react";
import { PROJECT_METADATA } from "@/config/landingConfig";

export const LandingFooter = () => {
  const { currentUser, isGuest, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const handleGuestEntry = () => {
    continueAsGuest();
    navigate("/dashboard");
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-background relative overflow-hidden">
      {/* SECTION 13: FINAL CTA */}
      <div className="py-20 border-b border-border/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-card to-background border border-primary/30 relative overflow-hidden shadow-2xl">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-safe/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono-tech mb-6">
                <span className="w-2 h-2 rounded-full bg-safe animate-ping" />
                <span>EXPERIENCE THE ECOSYSTEM</span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4 font-['Poppins']">
                Ready to Explore AROHAN?
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8">
                Explore the system, view the technology behind it, or enter the monitoring dashboard.
                You can explore live telemetry immediately in safe read-only Guest Mode without creating an account.
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                {currentUser || isGuest ? (
                  <Link to="/dashboard">
                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-12 px-7 shadow-lg shadow-primary/20">
                      <Activity className="w-4 h-4 mr-2 text-safe" />
                      Explore Dashboard
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleGuestEntry}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-12 px-7 shadow-lg shadow-primary/20"
                  >
                    <Terminal className="w-4 h-4 mr-2" />
                    Continue as Guest
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}

                <a
                  href={PROJECT_METADATA.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary text-sm h-12 px-6">
                    <Github className="w-4 h-4 mr-2" />
                    View on GitHub
                    <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-60" />
                  </Button>
                </a>

                {!currentUser && !isGuest && (
                  <Link to="/signin">
                    <Button size="lg" variant="ghost" className="text-sm h-12 text-muted-foreground hover:text-foreground">
                      Sign In to Operator Account →
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 14: FOOTER */}
      <div className="py-14 bg-card/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Brand column */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-lg tracking-wider text-foreground">AROHAN</span>
                  <p className="text-xs text-muted-foreground">Autonomous Safety &amp; Hazard Monitoring System</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                An AI and IoT-powered safety system combining environmental sensing, computer vision, 
                sensor fusion, and autonomous ground rover inspection into a unified emergency response ecosystem.
              </p>
              <div className="flex items-center gap-3 text-xs font-mono-tech text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-safe" />
                  All Systems Nominal
                </span>
                <span>•</span>
                <span>Version {PROJECT_METADATA.version}</span>
                <span>•</span>
                <span>MIT Open Source</span>
              </div>
            </div>

            {/* Quick Navigation Links */}
            <div>
              <h4 className="text-xs font-mono-tech uppercase text-foreground font-bold mb-4 tracking-wider">
                System Navigation
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <a href="#overview" className="hover:text-foreground transition-colors">
                    What is AROHAN?
                  </a>
                </li>
                <li>
                  <a href="#problem" className="hover:text-foreground transition-colors">
                    Why AROHAN? (The Problem)
                  </a>
                </li>
                <li>
                  <a href="#workflow" className="hover:text-foreground transition-colors">
                    How It Works (Pipeline)
                  </a>
                </li>
                <li>
                  <a href="#architecture" className="hover:text-foreground transition-colors">
                    System Architecture
                  </a>
                </li>
                <li>
                  <a href="#rover" className="hover:text-foreground transition-colors">
                    Hardware &amp; Rover Platform
                  </a>
                </li>
                <li>
                  <a href="#ai-vision" className="hover:text-foreground transition-colors">
                    AI &amp; Computer Vision
                  </a>
                </li>
                <li>
                  <a href="#demo" className="hover:text-foreground transition-colors">
                    Demonstration Video
                  </a>
                </li>
              </ul>
            </div>

            {/* Application & Resources */}
            <div>
              <h4 className="text-xs font-mono-tech uppercase text-foreground font-bold mb-4 tracking-wider">
                Resources &amp; Access
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <Link to="/signin" className="hover:text-foreground transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <button onClick={handleGuestEntry} className="hover:text-foreground transition-colors text-left">
                    Continue as Guest
                  </button>
                </li>
                <li>
                  <Link to="/dashboard" className="hover:text-foreground transition-colors">
                    Monitoring Dashboard
                  </Link>
                </li>
                <li>
                  <a href={PROJECT_METADATA.links.github} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    GitHub Repository
                  </a>
                </li>
                <li>
                  <a href={PROJECT_METADATA.links.dataset} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    HuggingFace Dataset
                  </a>
                </li>
                <li>
                  <a href="#docs" className="hover:text-foreground transition-colors">
                    Project Documentation
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom attribution */}
          <div className="pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-mono-tech">
            <div>
              © 2026 AROHAN. Engineered by <span className="text-foreground font-semibold">Team TECHEEZ</span> ({PROJECT_METADATA.team.lead} &amp; {PROJECT_METADATA.team.coLead}).
            </div>
            <button
              onClick={scrollToTop}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to top ↑
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
