import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Mail, ArrowLeft, Globe, MapPin } from "lucide-react";
import mascotImage from "@/assets/mascot-cutesy.png";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/hooks/useAnalytics";
import { containsProfanity } from "@/lib/profanity";

// Password validation rules
const validatePassword = (password: string) => {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
  <div className="flex items-center gap-2 text-sm">
    {met ? (
      <Check className="w-4 h-4 text-green-500" />
    ) : (
      <X className="w-4 h-4 text-muted-foreground" />
    )}
    <span className={cn(met ? "text-green-600" : "text-muted-foreground")}>{text}</span>
  </div>
);

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics("auth");

  const passwordValidation = validatePassword(password);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    } else {
      track("sign_in");
      navigate("/home");
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (containsProfanity(email)) {
      toast({
        title: "Inappropriate content",
        description: "Your email contains inappropriate language. Please use a different email.",
        variant: "destructive",
      });
      return;
    }
    
    if (!isPasswordValid) {
      toast({
        title: "Password too weak",
        description: "Please meet all password requirements.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    const { error } = await signUp(email, password);
    
    if (error) {
      toast({
        title: "Error signing up",
        description: error.message,
        variant: "destructive",
      });
    } else {
      track("sign_up");
      setPendingVerification(true);
      toast({
        title: "Check your email!",
        description: "We've sent you a verification link to complete your registration.",
      });
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        title: "Error sending reset email",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setResetEmailSent(true);
      toast({
        title: "Check your email!",
        description: "We've sent you a password reset link.",
      });
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
            onClick={() => {
              setShowForgotPassword(false);
              setResetEmailSent(false);
            }}
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
          <p className="text-muted-foreground text-sm mt-1">
            Enter your email and we'll send you a reset link
          </p>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Logo */}
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

        {/* Floating icons */}
        <div className="relative">
          <Globe className="absolute -left-8 top-0 w-6 h-6 text-primary/30 animate-pulse" />
          <MapPin className="absolute -right-6 top-12 w-5 h-5 text-accent/40 animate-pulse" />
        </div>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              renderForgotPassword()
            ) : (
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin">
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
                      <Input
                        id="signin-password"
                        type="password"
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
                </TabsContent>
                
                <TabsContent value="signup">
                  {pendingVerification ? (
                    <div className="text-center py-6 space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <Mail className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Verify your email</h3>
                        <p className="text-muted-foreground text-sm mt-1">
                          We've sent a verification link to <strong>{email}</strong>
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Click the link in your email to complete registration. Check your spam folder if you don't see it.
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => setPendingVerification(false)}
                        className="mt-4"
                      >
                        Use a different email
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onFocus={() => setShowPasswordRules(true)}
                          required
                          minLength={8}
                        />
                        {showPasswordRules && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-1">
                            <p className="text-xs font-medium mb-2">Password must have:</p>
                            <PasswordRequirement met={passwordValidation.minLength} text="At least 8 characters" />
                            <PasswordRequirement met={passwordValidation.hasUppercase} text="One uppercase letter" />
                            <PasswordRequirement met={passwordValidation.hasLowercase} text="One lowercase letter" />
                            <PasswordRequirement met={passwordValidation.hasNumber} text="One number" />
                            <PasswordRequirement met={passwordValidation.hasSpecial} text="One special character" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                        <Input
                          id="signup-confirm-password"
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                        {confirmPassword && (
                          <div className="flex items-center gap-2 text-sm">
                            {password === confirmPassword ? (
                              <>
                                <Check className="w-4 h-4 text-green-500" />
                                <span className="text-green-600">Passwords match</span>
                              </>
                            ) : (
                              <>
                                <X className="w-4 h-4 text-destructive" />
                                <span className="text-destructive">Passwords don't match</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <Button type="submit" className="w-full" disabled={loading || !isPasswordValid || password !== confirmPassword}>
                        {loading ? "Creating account..." : "Create Account"}
                      </Button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
