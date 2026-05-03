import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft, Globe, MapPin, ShieldAlert } from "lucide-react";
import mascotImage from "@/assets/mascot-cutesy.png";
import { toast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/useAnalytics";
import { sendResetEmail } from "@/lib/authEmail";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics("auth");

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setInterval(() => setResetCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resetCooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      if (error.message.toLowerCase().includes("banned") || error.message.toLowerCase().includes("suspended")) {
        setIsBanned(true);
      } else {
        toast({ title: "Error signing in", description: error.message, variant: "destructive" });
      }
    } else {
      track("sign_in");
      navigate("/home");
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error, retryAfter } = await sendResetEmail(email);

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
      if (retryAfter) setResetCooldown(retryAfter);
    } else {
      setResetEmailSent(true);
      setResetCooldown(60);
      toast({ title: "Check your email!", description: "We've sent you a password reset link." });
    }

    setLoading(false);
  };

  const renderForgotPassword = () => {
    if (resetEmailSent) {
      return (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Check your email</h3>
            <p className="text-muted-foreground text-sm mt-1">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Click the link in your email to reset your password. Check your spam folder if you don't see it.
          </p>
          <Button
            variant="outline"
            onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => setShowForgotPassword(false)}
          className="p-0 h-auto text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sign In
        </Button>

        <div className="text-center py-4">
          <h3 className="font-semibold text-lg">Forgot your password?</h3>
          <p className="text-muted-foreground text-sm mt-1">Enter your email and we'll send you a reset link</p>
        </div>

        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || resetCooldown > 0}>
            {loading ? "Sending..." : resetCooldown > 0 ? `Resend in ${resetCooldown}s` : "Send Reset Link"}
          </Button>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <div className="w-full max-w-md space-y-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: 'hsl(var(--logo-bg))' }}>
              <img src={mascotImage} alt="Tori-Tan" className="w-10 h-10 object-contain" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground">Travela</h1>
            <p className="text-muted-foreground mt-2">Connect with locals worldwide</p>
          </div>
        </div>

        <div className="relative">
          <Globe className="absolute -left-8 top-0 w-6 h-6 text-primary/30 animate-pulse" />
          <MapPin className="absolute -right-6 top-12 w-5 h-5 text-accent/40 animate-pulse" />
        </div>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your Travela account</CardDescription>
          </CardHeader>
          <CardContent>
            {isBanned ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Account Suspended</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    This account has been suspended for violating Travela's community guidelines.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  If you believe this is a mistake, please contact support.
                </p>
                <Button variant="outline" onClick={() => setIsBanned(false)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </div>
            ) : showForgotPassword ? (
              renderForgotPassword()
            ) : (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <PasswordInput
                    id="signin-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot your password?
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
