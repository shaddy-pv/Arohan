import { useEffect } from "react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingSidebarNav } from "@/components/landing/LandingSidebarNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingWhatIs } from "@/components/landing/LandingWhatIs";
import { LandingProblem } from "@/components/landing/LandingProblem";
import { LandingWorkflow } from "@/components/landing/LandingWorkflow";
import { LandingArchitecture } from "@/components/landing/LandingArchitecture";
import { LandingHardwareRover } from "@/components/landing/LandingHardwareRover";
import { LandingAiVision } from "@/components/landing/LandingAiVision";
import { LandingVideoDemo } from "@/components/landing/LandingVideoDemo";
import { LandingComponents } from "@/components/landing/LandingComponents";
import { LandingProjectStatus } from "@/components/landing/LandingProjectStatus";
import { LandingOpenSource } from "@/components/landing/LandingOpenSource";
import { LandingDocumentation } from "@/components/landing/LandingDocumentation";
import { LandingFooter } from "@/components/landing/LandingFooter";

const LandingPage = () => {
  useEffect(() => {
    // Smooth scroll offset adjustment if URL has hash
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-foreground flex flex-col selection:bg-blue-600/30 selection:text-white relative">
      {/* Streamlined Clean Navigation Bar (Logo, Name, Guest & Auth Only) */}
      <LandingNavbar />

      {/* Narrow Vertical Side Navigation Rail (64px width, Fixed Left) */}
      <LandingSidebarNav />

      {/* Main Content Sections: Original Centered Layout */}
      <main className="flex-grow">
        {/* Section 1: Clean Minimal Hero with AROHAN Blue Identity */}
        <LandingHero />

        {/* Section 2: What is AROHAN? */}
        <LandingWhatIs />

        {/* Section 3: The Problem (Why AROHAN?) */}
        <LandingProblem />

        {/* Section 4: How It Works (Visual Pipeline) */}
        <LandingWorkflow />

        {/* Section 5: System Architecture */}
        <LandingArchitecture />

        {/* Section 6: Hardware & Autonomous Rover */}
        <LandingHardwareRover />

        {/* Section 7: AI + Computer Vision */}
        <LandingAiVision />

        {/* Section 8: Video & Live Demonstration */}
        <LandingVideoDemo />

        {/* Section 9: Six Project Components */}
        <LandingComponents />

        {/* Section 10: Real Project Status */}
        <LandingProjectStatus />

        {/* Section 11: Open Source Collaboration */}
        <LandingOpenSource />

        {/* Section 12: Project Documentation */}
        <LandingDocumentation />

        {/* Section 13 (Final CTA) & Section 14 (Footer) */}
        <LandingFooter />
      </main>
    </div>
  );
};

export default LandingPage;
