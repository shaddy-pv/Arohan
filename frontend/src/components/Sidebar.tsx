import { NavLink } from "@/components/NavLink";
import { 
  LayoutDashboard, 
  Cpu, 
  AlertTriangle, 
  History, 
  Settings, 
  LogOut, 
  User, 
  Lightbulb, 
  Camera,
  Globe,
  Terminal,
  LogIn
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export const Sidebar = () => {
  const { currentUser, isGuest, logout, exitGuest } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/rover", icon: Cpu, label: "Rover Console" },
    { to: "/face-recognition", icon: Camera, label: "Face Recognition" },
    { to: "/solution", icon: Lightbulb, label: "Solution" },
    { to: "/alerts", icon: AlertTriangle, label: "Alerts" },
    { to: "/history", icon: History, label: "History" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      if (isGuest) {
        exitGuest();
        toast({
          title: "Exited Guest Mode",
          description: "Returned to public project overview"
        });
        navigate("/");
      } else {
        await logout();
        toast({
          title: "Logged Out",
          description: "You have been successfully logged out"
        });
        navigate("/signin");
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: "Failed to logout. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside className="w-64 bg-card border-r border-border h-screen sticky top-0 flex flex-col z-20">
      {/* Brand Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold font-['Poppins']">AROHAN</h1>
          <span className="text-[10px] font-mono-tech px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
            v2.0
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Command Center</p>
      </div>

      {/* Guest Mode Indicator Notice */}
      {isGuest && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <div className="flex items-center gap-1.5 text-xs font-bold font-mono-tech mb-0.5">
            <Terminal className="w-3.5 h-3.5" />
            <span>GUEST MODE</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Read-only simulation. Hardware writes disabled.
          </p>
        </div>
      )}

      {/* Main Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-4 py-3 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm"
            activeClassName="bg-accent text-foreground font-semibold"
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* Public Project Website Link */}
        <div className="pt-2 border-t border-border/50">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-xs font-mono-tech"
          >
            <Globe className="w-4 h-4 text-primary" />
            <span>Project Website</span>
          </Link>
        </div>
      </nav>

      {/* User Info / Actions Footer */}
      <div className="p-4 border-t border-border space-y-3">
        {/* Real User Info */}
        {currentUser && (
          <div className="px-4 py-2 bg-secondary rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold">Operator:</span>
            </div>
            <p className="text-xs text-muted-foreground truncate font-mono-tech" title={currentUser.email || ''}>
              {currentUser.email}
            </p>
          </div>
        )}

        {/* Guest Action Option: Sign In */}
        {isGuest && (
          <Link to="/signin" className="block">
            <button
              className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-md bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In as Operator</span>
            </button>
          </Link>
        )}

        {/* Logout / Exit Guest Button */}
        <button 
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>{loggingOut ? "Exiting..." : isGuest ? "Exit Guest Mode" : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
};
