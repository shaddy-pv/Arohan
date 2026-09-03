import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ShieldAlert, 
  ArrowRight, 
  Activity,
  Terminal,
  LogIn
} from "lucide-react";
import { PROJECT_METADATA } from "@/config/landingConfig";

export const LandingNavbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const { currentUser, isGuest, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGuestEntry = () => {
    continueAsGuest();
    navigate("/dashboard");
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-neutral-950/80 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/50"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-18 sm:h-20 flex items-center justify-between">
        {/* Brand Logo & Name Only */}
        <Link to="/" className="flex items-center gap-3.5 group">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:border-blue-500/60 group-hover:bg-blue-500/15 transition-all duration-200 shadow-[0_0_15px_rgba(37,99,235,0.15)]">
            <ShieldAlert className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-wider text-white font-['Poppins']">
                AROHAN
              </span>
              <span className="text-[10px] font-mono-tech uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25">
                v{PROJECT_METADATA.version}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 hidden sm:block tracking-wide">
              Autonomous Safety &amp; Hazard Monitoring
            </p>
          </div>
        </Link>

        {/* Right Side: Guest & Login/Sign Up Buttons Only */}
        <div className="flex items-center gap-3">
          {/* Guest Mode Button */}
          {!currentUser && !isGuest && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGuestEntry}
              className="border-white/15 bg-white/[0.03] text-neutral-200 hover:bg-white/[0.08] hover:text-white hover:border-blue-500/40 text-xs h-9 px-4 rounded-lg transition-all"
            >
              <Terminal className="w-3.5 h-3.5 mr-2 text-blue-400" />
              Continue as Guest
            </Button>
          )}

          {/* Sign In / Sign Up or Dashboard */}
          {currentUser || isGuest ? (
            <Link to="/dashboard">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 px-4 rounded-lg font-medium shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all border border-blue-400/30">
                <Activity className="w-3.5 h-3.5 mr-1.5 text-blue-200" />
                Open Dashboard
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/signin">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 px-4 rounded-lg font-medium shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all border border-blue-400/30">
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  Sign In
                </Button>
              </Link>
              <Link to="/signup" className="hidden sm:inline-block">
                <Button size="sm" variant="ghost" className="text-xs h-9 px-3 text-neutral-300 hover:text-white hover:bg-white/[0.05]">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
