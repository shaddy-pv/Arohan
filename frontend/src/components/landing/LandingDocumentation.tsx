import { 
  BookOpen, 
  FileText, 
  ExternalLink, 
  Layers, 
  Database, 
  Cpu, 
  Workflow, 
  Compass,
  FileCode
} from "lucide-react";
import { PROJECT_METADATA } from "@/config/landingConfig";

export const LandingDocumentation = () => {
  const repoBase = "https://github.com/shaddy-pv/Arohan/blob/main/";

  const docCards = [
    {
      title: "System Setup Guide",
      file: "docs/SETUP.md",
      desc: "Full installation instructions for Node.js frontend, Python Flask CV server, and Arduino rover firmware.",
      url: `${repoBase}docs/SETUP.md`,
      icon: Cpu,
    },
    {
      title: "System Architecture",
      file: "docs/ARCHITECTURE.md",
      desc: "Detailed breakdown of hardware, edge computer vision, Firebase RTDB schema, and security rules.",
      url: `${repoBase}docs/ARCHITECTURE.md`,
      icon: Layers,
    },
    {
      title: "Backend & CV API",
      file: "docs/API.md",
      desc: "REST endpoints, MJPEG stream protocols, face recognition services, and Twilio alert triggers.",
      url: `${repoBase}docs/API.md`,
      icon: FileCode,
    },
    {
      title: "System Flow & Logic",
      file: "docs/SYSTEM_FLOW.md",
      desc: "End-to-end data pipelines, normalization formulas, sensor fusion logic, and decision trees.",
      url: `${repoBase}docs/SYSTEM_FLOW.md`,
      icon: Workflow,
    },
    {
      title: "UI Components Library",
      file: "docs/COMPONENTS.md",
      desc: "Design tokens, color schemes, reusable Radix UI / Shadcn primitives, and layout structures.",
      url: `${repoBase}docs/COMPONENTS.md`,
      icon: Compass,
    },
    {
      title: "Database Rules & Schema",
      file: "docs/DATABASE.md",
      desc: "Firebase Realtime Database indexing, JSON tree structure, and authenticated access permissions.",
      url: `${repoBase}docs/DATABASE.md`,
      icon: Database,
    },
    {
      title: "Contribution Guide",
      file: "CONTRIBUTING.md",
      desc: "Standards for branch management, PR reviews, commit styling, and hardware integration guidelines.",
      url: `${repoBase}CONTRIBUTING.md`,
      icon: FileText,
    },
    {
      title: "HuggingFace Hazard Dataset",
      file: "Dataset Benchmark",
      desc: "Public multi-modal hazard detection benchmark containing fire imagery, gas metrics, and air quality CSVs.",
      url: PROJECT_METADATA.links.dataset,
      icon: Database,
    },
  ];

  return (
    <section id="docs" className="py-24 bg-card/20 border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            <span>ENGINEERING REFERENCES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            Project Documentation &amp; Resources
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            All system layers are thoroughly documented within the official repository. 
            Access setup guides, API specs, hardware schematics, and the published HuggingFace benchmark dataset.
          </p>
        </div>

        {/* Documentation Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {docCards.map((doc, idx) => {
            const Icon = doc.icon;
            return (
              <a
                key={idx}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-xl bg-card border border-border/80 hover:border-primary/50 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-secondary text-primary border border-border group-hover:border-primary/40 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {doc.title}
                  </h3>
                  <div className="text-[10px] font-mono-tech text-muted-foreground mb-2.5">
                    {doc.file}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {doc.desc}
                  </p>
                </div>

                <div className="pt-3 mt-4 border-t border-border/50 text-[11px] font-mono-tech text-primary flex items-center justify-between">
                  <span>View Documentation</span>
                  <span>→</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};
