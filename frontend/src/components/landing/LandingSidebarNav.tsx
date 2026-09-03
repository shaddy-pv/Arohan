import { useState, useEffect } from "react";
import { 
  Compass, 
  HelpCircle, 
  Workflow, 
  Layers, 
  Bot, 
  BrainCircuit, 
  Play, 
  Grid3X3, 
  Activity, 
  Github, 
  BookOpen, 
  ArrowUp,
  Menu,
  X
} from "lucide-react";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "problem", label: "Why AROHAN", icon: HelpCircle },
  { id: "workflow", label: "How It Works", icon: Workflow },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "rover", label: "Hardware & Rover", icon: Bot },
  { id: "ai-vision", label: "AI & CV", icon: BrainCircuit },
  { id: "demo", label: "Live Demo", icon: Play },
  { id: "components", label: "Components", icon: Grid3X3 },
  { id: "status", label: "Project Status", icon: Activity },
  { id: "opensource", label: "Open Source", icon: Github },
  { id: "docs", label: "Documentation", icon: BookOpen },
];

export const LandingSidebarNav = () => {
  const [activeSection, setActiveSection] = useState("hero");
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 280;

      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(SECTIONS[i].id);
          return;
        }
      }
      setActiveSection("hero");
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileExpanded(false);
    if (id === "hero") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      {/* Desktop & Tablet Narrow Navigation Rail (Fixed 64px width, No Content Overlap) */}
      <aside
        className="hidden md:flex fixed left-3 sm:left-4 top-1/2 -translate-y-1/2 z-40 w-14 lg:w-16 flex-col items-center"
        aria-label="Section navigation rail"
      >
        <div className="w-full p-2 rounded-2xl bg-neutral-950/70 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col items-center space-y-1.5">
          {/* Beacon dot */}
          <div className="w-6 h-6 flex items-center justify-center mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3B82F6] animate-pulse" />
          </div>

          {/* Section Navigation Items */}
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <div key={item.id} className="relative group w-full flex justify-center">
                <button
                  onClick={() => scrollTo(item.id)}
                  aria-label={item.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 relative ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? "text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]" : "text-neutral-400 group-hover:text-white"
                    }`}
                  />
                  {isActive && (
                    <span className="absolute -left-1 w-1 h-3 rounded-r-full bg-blue-500 shadow-[0_0_6px_#3B82F6]" />
                  )}
                </button>

                {/* Apple-style floating tooltip on the right of rail */}
                <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-neutral-900/95 backdrop-blur-md border border-blue-500/30 text-white text-xs font-mono-tech whitespace-nowrap shadow-2xl opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-150 z-50 flex items-center gap-2">
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="text-[10px] text-blue-400 font-semibold font-mono-tech">
                      • ACTIVE
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Return to Top Button */}
          <div className="pt-2 border-t border-white/10 w-full flex justify-center mt-1">
            <div className="relative group w-full flex justify-center">
              <button
                onClick={() => scrollTo("hero")}
                aria-label="Back to Top"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-neutral-900/95 backdrop-blur-md border border-white/20 text-white text-xs font-mono-tech whitespace-nowrap shadow-2xl opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-150 z-50">
                Back to Top
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Floating Drawer (< 768px) */}
      <div className="md:hidden fixed bottom-5 left-5 z-40">
        <button
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="px-3.5 py-2.5 rounded-full bg-neutral-900/90 backdrop-blur-xl border border-blue-500/30 text-white shadow-2xl flex items-center gap-2 text-xs font-mono-tech hover:bg-neutral-800 transition-colors"
          aria-label="Toggle navigation drawer"
        >
          {mobileExpanded ? <X className="w-4 h-4 text-blue-400" /> : <Menu className="w-4 h-4 text-blue-400" />}
          <span>Section Menu</span>
        </button>

        {mobileExpanded && (
          <div className="absolute bottom-14 left-0 w-64 p-3 rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-blue-500/20 shadow-2xl space-y-1 animate-in slide-in-from-bottom-3 duration-200 max-h-80 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] font-mono-tech text-blue-400 uppercase tracking-wider border-b border-white/10 mb-1 flex items-center justify-between">
              <span>Jump to Section</span>
              <span className="text-neutral-500">AROHAN v2.0</span>
            </div>
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                    isActive
                      ? "bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30"
                      : "text-neutral-300 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-neutral-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
