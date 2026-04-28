import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, Check, X, KeyRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  const passwordValidation = validatePassword(password);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // User should have a session from clicking the recovery link
      if (session) {
        setIsValidSession(true);
      } else {
        toast({
          title: "Invalid or expired link",
          description: "Please request a new password reset link.",
          variant: "destructive",
        });
        navigate("/");
      }
      setCheckingSession(false);
    };

    checkSession();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast({
        title: "Password too weak",
        description: "Please meet all password requirements.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      toast({
        title: "Error resetting password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password updated!",
        description: "Your password has been successfully reset.",
      });
      navigate("/home");
    }

    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isValidSession) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <Plane className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground">Travela</h1>
            <p className="text-muted-foreground mt-2">Set your new password</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <PasswordInput
                  id="new-password"
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
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <PasswordInput
                  id="confirm-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-2 text-sm mt-1">
                    {passwordsMatch ? (
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
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !isPasswordValid || !passwordsMatch}
              >
                {loading ? "Updating password..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
