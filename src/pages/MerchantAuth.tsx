import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Check, X, Mail, ArrowLeft, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import mascotImage from "@/assets/mascot-cutesy.png";

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

const MerchantAuth = () => {
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [registrationMethod, setRegistrationMethod] = useState<"email" | "phone">("email");
  const navigate = useNavigate();

  const passwordValidation = validatePassword(password);
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/merchant-dashboard");
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeName.trim()) {
      toast({
        title: "Store name required",
        description: "Please enter your store name.",
        variant: "destructive",
      });
      return;
    }

    if (storeName.trim().length > 100) {
      toast({
        title: "Store name too long",
        description: "Store name must be less than 100 characters.",
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

    setLoading(true);

    // Sign up with email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError) {
      toast({
        title: "Error signing up",
        description: authError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // If we have a user, create their store and role (will work after email verification)
    if (authData.user) {
      // Store the merchant data in localStorage temporarily for after verification
      localStorage.setItem("pendingMerchantData", JSON.stringify({
        storeName: storeName.trim(),
        phone: phone.trim() || null,
      }));
    }

    setPendingVerification(true);
    toast({
      title: "Check your email!",
      description: "We've sent you a verification link to complete your registration.",
    });

    setLoading(false);
  };

  const handleBackToRoleSelect = () => {
    localStorage.removeItem("selectedRole");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-pink-100 flex flex-col items-center justify-center p-4">
      {/* Mascot */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-6"
      >
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="absolute -top-14 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-2xl shadow-md border-2 border-pink-200 whitespace-nowrap"
          >
            <p className="text-pink-600 font-medium text-sm">Let's set up your store! 🏪</p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white"></div>
          </motion.div>
          <img
            src={mascotImage}
            alt="Mascot"
            className="w-24 h-24 object-contain mix-blend-multiply"
          />
        </div>
      </motion.div>

      <div className="w-full max-w-md space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={handleBackToRoleSelect}
          className="text-pink-600 hover:text-pink-700 hover:bg-pink-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="border-2 border-pink-200 shadow-lg bg-white/80 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-pink-100 flex items-center justify-center mb-2">
              <Store className="w-6 h-6 text-pink-500" />
            </div>
            <CardTitle className="text-xl text-pink-700">Merchant Registration</CardTitle>
            <CardDescription className="text-pink-400">
              Create your merchant account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signup" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-pink-100">
                <TabsTrigger value="signin" className="data-[state=active]:bg-white data-[state=active]:text-pink-600">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-white data-[state=active]:text-pink-600">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-pink-700">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-pink-700">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white" 
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {pendingVerification ? (
                  <div className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-pink-100 flex items-center justify-center">
                      <Mail className="w-8 h-8 text-pink-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-pink-700">Verify your email</h3>
                      <p className="text-pink-400 text-sm mt-1">
                        We've sent a verification link to <strong>{email}</strong>
                      </p>
                    </div>
                    <p className="text-sm text-pink-400">
                      Click the link in your email to complete registration. Check your spam folder if you don't see it.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setPendingVerification(false)}
                      className="mt-4 border-pink-300 text-pink-600 hover:bg-pink-50"
                    >
                      Use a different email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    {/* Store Name */}
                    <div className="space-y-2">
                      <Label htmlFor="store-name" className="text-pink-700">What is your store name?</Label>
                      <Input
                        id="store-name"
                        type="text"
                        placeholder="My Awesome Store"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                        maxLength={100}
                        required
                      />
                    </div>

                    {/* Registration Method Toggle */}
                    <div className="space-y-2">
                      <Label className="text-pink-700">Register with</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={registrationMethod === "email" ? "default" : "outline"}
                          onClick={() => setRegistrationMethod("email")}
                          className={cn(
                            "flex-1",
                            registrationMethod === "email" 
                              ? "bg-pink-500 hover:bg-pink-600 text-white" 
                              : "border-pink-200 text-pink-600 hover:bg-pink-50"
                          )}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </Button>
                        <Button
                          type="button"
                          variant={registrationMethod === "phone" ? "default" : "outline"}
                          onClick={() => setRegistrationMethod("phone")}
                          className={cn(
                            "flex-1",
                            registrationMethod === "phone" 
                              ? "bg-pink-500 hover:bg-pink-600 text-white" 
                              : "border-pink-200 text-pink-600 hover:bg-pink-50"
                          )}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Phone
                        </Button>
                      </div>
                    </div>

                    {/* Email Input */}
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-pink-700">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                        required
                      />
                    </div>

                    {/* Phone Input (optional or required based on method) */}
                    {registrationMethod === "phone" && (
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone" className="text-pink-700">Phone Number</Label>
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="+1 234 567 8900"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                          required={registrationMethod === "phone"}
                        />
                        <p className="text-xs text-pink-400">We'll also need your email for account verification</p>
                      </div>
                    )}

                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-pink-700">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setShowPasswordRules(true)}
                        className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                        required
                        minLength={8}
                      />
                      {showPasswordRules && (
                        <div className="mt-3 p-3 bg-pink-50 rounded-lg space-y-1 border border-pink-200">
                          <p className="text-xs font-medium mb-2 text-pink-700">Password must have:</p>
                          <PasswordRequirement met={passwordValidation.minLength} text="At least 8 characters" />
                          <PasswordRequirement met={passwordValidation.hasUppercase} text="One uppercase letter" />
                          <PasswordRequirement met={passwordValidation.hasLowercase} text="One lowercase letter" />
                          <PasswordRequirement met={passwordValidation.hasNumber} text="One number" />
                          <PasswordRequirement met={passwordValidation.hasSpecial} text="One special character" />
                        </div>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-pink-500 hover:bg-pink-600 text-white" 
                      disabled={loading || !isPasswordValid}
                    >
                      {loading ? "Creating account..." : "Create Merchant Account"}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantAuth;
