import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  ExternalLink, 
  Video, 
  ShieldCheck, 
  AlertCircle, 
  Info,
  Maximize2,
  Layers
} from "lucide-react";
import { DEMO_VIDEOS, DemoVideoItem } from "@/config/landingConfig";

export const LandingVideoDemo = () => {
  const [selectedVideo, setSelectedVideo] = useState<DemoVideoItem>(DEMO_VIDEOS[0]);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <section id="demo" className="py-24 bg-card/30 border-b border-border/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono-tech mb-4">
            <Video className="w-3.5 h-3.5" />
            <span>PROJECT DEMONSTRATION</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
            See AROHAN in Action
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Watch real hardware demonstrations and operational telemetry runs from the AROHAN system. 
            The video below showcases end-to-end multi-sensor hazard detection and live camera validation.
          </p>
        </div>

        {/* Video Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
          {DEMO_VIDEOS.map((video) => {
            const isSelected = selectedVideo.id === video.id;
            return (
              <button
                key={video.id}
                onClick={() => {
                  setSelectedVideo(video);
                  setIframeLoaded(false);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono-tech transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.25)]"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Play className="w-3 h-3" />
                <span>{video.title}</span>
                {video.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
                    isSelected 
                      ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30" 
                      : "bg-secondary text-muted-foreground border-border"
                  }`}>
                    {video.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Video Player Container */}
        <div className="rounded-2xl border border-border/80 bg-background overflow-hidden shadow-2xl">
          {selectedVideo.isAvailable && selectedVideo.embedUrl ? (
            <div className="relative w-full aspect-video bg-black/90 flex items-center justify-center">
              {/* Spinner while loading iframe */}
              {!iframeLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground z-0">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-xs font-mono-tech">Loading demonstration stream...</span>
                </div>
              )}

              {/* Responsive Google Drive Embed Player */}
              <iframe
                src={selectedVideo.embedUrl}
                title={selectedVideo.title}
                className="w-full h-full border-0 relative z-10"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={() => setIframeLoaded(true)}
              />
            </div>
          ) : (
            /* Standby / Placeholder card for additional recordings */
            <div className="w-full aspect-video bg-secondary/30 flex flex-col items-center justify-center p-8 text-center border-dashed border-2 border-border/60">
              <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
                <Video className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 font-mono-tech">
                {selectedVideo.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
                {selectedVideo.description}
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={selectedVideo.directUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-xs font-mono-tech text-foreground"
                >
                  <span>Explore Associated Firmware &amp; Code</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Video Footer Metadata & Fallback Action */}
          <div className="p-4 sm:p-6 bg-card border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono-tech text-primary font-bold">
                  {selectedVideo.category.toUpperCase()}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground font-mono-tech">
                  {selectedVideo.duration || "Recorded Run"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                {selectedVideo.description}
              </p>
            </div>

            {selectedVideo.directUrl && (
              <a
                href={selectedVideo.directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-mono-tech text-foreground shrink-0 transition-colors"
              >
                <span>Direct Drive Player</span>
                <ExternalLink className="w-3.5 h-3.5 text-primary" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
