import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Terminal, ShieldAlert } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { login, currentUser, resetPassword, continueAsGuest } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Redirect if already logged in
  if (currentUser) {
    navigate("/dashboard");
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast({
        title: "Login Successful",
        description: `Welcome back, ${email}!`
      });
      navigate("/dashboard");
    } catch (error: unknown) {
      const err = error as { code?: string };
      console.error("Login error:", err);
      let errorMessage = "Failed to login. Please try again.";
      
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGuestEntry = () => {
    continueAsGuest();
    toast({
      title: "Guest Mode Active",
      description: "You are accessing AROHAN in safe read-only simulation mode."
    });
    navigate("/dashboard");
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address to reset your password",
        variant: "destructive"
      });
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(email);
      toast({
        title: "Password Reset Email Sent",
        description: `Check your inbox at ${email} for password reset instructions.`
      });
    } catch (error: unknown) {
      const err = error as { code?: string };
      console.error("Password reset error:", err);
      let errorMessage = "Failed to send password reset email.";
      
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      }
      
      toast({
        title: "Password Reset Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      {/* Subtle pattern background */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(var(--foreground)) 10px, hsl(var(--foreground)) 11px)`
      }} />
      
      <div className="w-full max-w-md p-8 bg-card border border-border rounded-xl relative z-10 shadow-2xl">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono-tech transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Project Overview</span>
          </Link>
        </div>

        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mx-auto mb-3 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold mb-1 font-['Poppins']">AROHAN</h1>
          <p className="text-xs text-muted-foreground font-mono-tech">Mission Control • Command Center</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-mono-tech">Operator Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@arohan.com"
              required
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-mono-tech">Password</Label>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {resetLoading ? "Sending..." : "Forgot?"}
              </button>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-background"
            />
          </div>

          <Button type="submit" className="w-full text-xs h-10 font-medium shadow-md" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating Operator...
              </>
            ) : (
              "Sign In to Command Center"
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs font-mono-tech uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Continue as Guest Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGuestEntry}
          className="w-full border-primary/40 text-primary hover:bg-primary/10 text-xs h-10"
        >
          <Terminal className="w-4 h-4 mr-2" />
          Continue as Guest (Safe Simulation)
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Need an operator account?{" "}
          <Link to="/signup" className="text-primary hover:underline font-semibold">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
