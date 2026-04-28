import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Check, X, Mail, ArrowLeft, Phone, Landmark, Utensils, Gamepad2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import mascotImage from "@/assets/mascot-cutesy.png";

type StoreType = "attractions" | "food" | "entertainment";

const storeTypeOptions = [
  { value: "attractions" as StoreType, label: "Attractions", icon: Landmark, description: "Museums, landmarks, tours" },
  { value: "food" as StoreType, label: "Food", icon: Utensils, description: "Restaurants, cafes, bars" },
  { value: "entertainment" as StoreType, label: "Entertainment", icon: Gamepad2, description: "Shows, games, activities" },
];

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
  const [storeType, setStoreType] = useState<StoreType>("food");
  const [storeAddress, setStoreAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      toast({ title: "Store name required", description: "Please enter your store name.", variant: "destructive" });
      return;
    }

    if (storeName.trim().length > 100) {
      toast({ title: "Store name too long", description: "Store name must be less than 100 characters.", variant: "destructive" });
      return;
    }

    if (!isPasswordValid) {
      toast({ title: "Password too weak", description: "Please meet all password requirements.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure your passwords match.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      toast({ title: "Error signing up", description: authError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (authData.user) {
      sessionStorage.setItem("pendingMerchantData", JSON.stringify({
        storeName: storeName.trim(),
        storeType: storeType,
        phone: phone.trim() || null,
        address: storeAddress.trim() || null,
      }));
    }

    setPendingVerification(true);
    toast({ title: "Check your email!", description: "We've sent you a verification link to complete your registration." });
    setLoading(false);
  };

  const handleBackToRoleSelect = () => {
    localStorage.removeItem("selectedRole");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex flex-col items-center justify-center p-4">
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
            className="absolute -top-14 left-1/2 -translate-x-1/2 bg-card px-4 py-2 rounded-2xl shadow-md border-2 border-border whitespace-nowrap"
          >
            <p className="text-primary font-medium text-sm">Let's set up your store! 🏪</p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-card"></div>
          </motion.div>
          <img src={mascotImage} alt="Mascot" className="w-24 h-24 object-contain mix-blend-multiply" />
        </div>
      </motion.div>

      <div className="w-full max-w-md space-y-6">
        <Button variant="ghost" onClick={handleBackToRoleSelect} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="border-2 border-border shadow-lg bg-card/80 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl text-foreground">Merchant Registration</CardTitle>
            <CardDescription className="text-muted-foreground">Create your merchant account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signup" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <PasswordInput id="signin-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
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
                      <h3 className="font-semibold text-lg text-foreground">Verify your email</h3>
                      <p className="text-muted-foreground text-sm mt-1">
                        We've sent a verification link to <strong>{email}</strong>
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Click the link in your email to complete registration. Check your spam folder if you don't see it.
                    </p>
                    <Button variant="outline" onClick={() => setPendingVerification(false)} className="mt-4">
                      Use a different email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="store-name">What is your store name?</Label>
                      <Input id="store-name" type="text" placeholder="My Awesome Store" value={storeName} onChange={(e) => setStoreName(e.target.value)} maxLength={100} required />
                    </div>

                    <div className="space-y-2">
                      <Label>What type of store is this?</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {storeTypeOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setStoreType(option.value)}
                            className={cn(
                              "p-3 rounded-lg border-2 transition-all text-center",
                              storeType === option.value
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 bg-card"
                            )}
                          >
                            <option.icon className={cn("w-6 h-6 mx-auto mb-1", storeType === option.value ? "text-primary" : "text-muted-foreground")} />
                            <p className={cn("text-xs font-medium", storeType === option.value ? "text-foreground" : "text-muted-foreground")}>{option.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="store-address">Store Address</Label>
                      <Input id="store-address" type="text" placeholder="123 Main Street, City, Country" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
                      <p className="text-xs text-muted-foreground">This helps travelers find you on the map</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Register with</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={registrationMethod === "email" ? "default" : "outline"}
                          onClick={() => setRegistrationMethod("email")}
                          className="flex-1"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </Button>
                        <Button
                          type="button"
                          variant={registrationMethod === "phone" ? "default" : "outline"}
                          onClick={() => setRegistrationMethod("phone")}
                          className="flex-1"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Phone
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>

                    {registrationMethod === "phone" && (
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone">Phone Number</Label>
                        <Input id="signup-phone" type="tel" placeholder="+1 234 567 8900" value={phone} onChange={(e) => setPhone(e.target.value)} required={registrationMethod === "phone"} />
                        <p className="text-xs text-muted-foreground">We'll also need your email for account verification</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <PasswordInput id="signup-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setShowPasswordRules(true)} required minLength={8} />
                      {showPasswordRules && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-1 border border-border">
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
                      <PasswordInput id="signup-confirm-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
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
