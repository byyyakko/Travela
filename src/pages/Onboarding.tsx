import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndModerate } from "@/lib/moderateImage";
import { validateRealLocation } from "@/lib/validateLocation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { 
  Camera, MapPin, Plane, ChevronRight, ChevronLeft, 
  User, Sparkles, Check, Globe, LogOut
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/hooks/useAnalytics";
import { containsProfanity, containsProfanityWithAI } from "@/lib/profanity";
import { COMMON_LANGUAGES } from "@/lib/languages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STEPS = [
  { id: 1, title: "Welcome", icon: Sparkles },
  { id: 2, title: "Photo", icon: Camera },
  { id: 3, title: "About You", icon: User },
  { id: 4, title: "Interests", icon: Sparkles },
  { id: 5, title: "Location", icon: MapPin },
];

const SUGGESTED_INTERESTS = [
  "Food & Cuisine", "History", "Art & Museums", "Nightlife", 
  "Nature", "Photography", "Architecture", "Shopping",
  "Music", "Sports", "Beach", "Mountains", "Culture", "Adventure"
];

const Onboarding = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { track } = useAnalytics("onboarding");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [location, setLocation] = useState("");
  const [isLocal, setIsLocal] = useState(false);
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState("");

  const progress = (currentStep / STEPS.length) * 100;

  const [avatarChecking, setAvatarChecking] = useState(false);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    setAvatarFile(file);
    
    // Moderate the image right away
    setAvatarChecking(true);
    try {
      const fileExt = file.name.split(".").pop();
      const tempFileName = `${user?.id}/temp_check_${Date.now()}.${fileExt}`;
      
      await uploadAndModerate("avatars", tempFileName, file, { upsert: true });
      
      // Moderation passed — clean up temp file, keep the local file for final upload
      await supabase.storage.from("avatars").remove([tempFileName]);
      
      toast({ title: "Photo accepted ✓", description: "Your photo passed our content check." });
    } catch (err: any) {
      // Moderation failed — clear the photo
      setAvatarFile(null);
      setAvatarUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({
        title: "Photo rejected",
        description: err.message || "This image was flagged as inappropriate and cannot be used.",
        variant: "destructive",
      });
    } finally {
      setAvatarChecking(false);
    }
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else if (interests.length < 20) {
      setInterests([...interests, interest]);
    }
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim()) && interests.length < 20) {
      if (containsProfanity(customInterest)) {
        toast({ title: "Inappropriate content", description: "Your interest contains inappropriate language.", variant: "destructive" });
        return;
      }
      setInterests([...interests, customInterest.trim()]);
      setCustomInterest("");
    }
  };

  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [showOtherLanguage, setShowOtherLanguage] = useState(false);

  const addLanguageFromDropdown = (lang: string) => {
    if (lang === "__other__") {
      setShowOtherLanguage(true);
      setSelectedLanguage("");
      return;
    }
    if (lang && !languages.includes(lang)) {
      setLanguages([...languages, lang]);
    }
    setSelectedLanguage("");
  };

  const addCustomLanguage = () => {
    const trimmed = languageInput.trim();
    if (!trimmed || languages.includes(trimmed)) return;
    if (containsProfanity(trimmed)) {
      toast({ title: "Inappropriate content", description: "Your language entry contains inappropriate language.", variant: "destructive" });
      return;
    }
    setLanguages([...languages, trimmed]);
    setLanguageInput("");
    setShowOtherLanguage(false);
  };

  const removeLanguage = (lang: string) => {
    setLanguages(languages.filter(l => l !== lang));
  };

  const [aiChecking, setAiChecking] = useState(false);

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 2:
        if (avatarChecking) {
          toast({ title: "Please wait", description: "Your photo is being checked...", variant: "destructive" });
          return false;
        }
        if (!displayName.trim()) {
          toast({ title: "Display name is required", variant: "destructive" });
          return false;
        }
        if (containsProfanity(displayName)) {
          toast({ title: "Inappropriate content", description: "Your display name contains inappropriate language.", variant: "destructive" });
          return false;
        }
        return true;
      case 3:
        if (containsProfanity(bio)) {
          toast({ title: "Inappropriate content", description: "Your bio contains inappropriate language.", variant: "destructive" });
          return false;
        }
        return true;
      case 4:
        if (interests.length === 0) {
          toast({ title: "Please select at least 1 interest", variant: "destructive" });
          return false;
        }
        if (interests.some(i => containsProfanity(i))) {
          toast({ title: "Inappropriate content", description: "One of your interests contains inappropriate language.", variant: "destructive" });
          return false;
        }
        return true;
      case 5:
        if (!location.trim()) {
          toast({ title: "Location is required", variant: "destructive" });
          return false;
        }
        if (containsProfanity(location)) {
          toast({ title: "Inappropriate content", description: "Your location contains inappropriate language.", variant: "destructive" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (currentStep >= STEPS.length || !canProceedFromStep(currentStep)) return;

    // AI profanity check on text fields for the current step
    const textsToCheck: string[] = [];
    if (currentStep === 2) textsToCheck.push(displayName);
    if (currentStep === 3) textsToCheck.push(bio, ...languages);
    if (currentStep === 4) textsToCheck.push(...interests.filter(i => !SUGGESTED_INTERESTS.includes(i)));
    if (currentStep === 5) textsToCheck.push(location);

    const nonEmpty = textsToCheck.filter(t => t && t.trim().length > 0);
    if (nonEmpty.length > 0) {
      setAiChecking(true);
      try {
        const results = await Promise.all(nonEmpty.map(t => containsProfanityWithAI(t)));
        if (results.some(r => r)) {
          toast({ title: "Inappropriate content detected", description: "Please remove any inappropriate language before proceeding.", variant: "destructive" });
          setAiChecking(false);
          return;
        }
      } catch { /* fail open */ }
    }

    // Validate location is a real place on step 5
    if (currentStep === 5 && location.trim()) {
      setAiChecking(true);
      const locationResult = await validateRealLocation(location);
      if (!locationResult.valid) {
        toast({ title: "Invalid location", description: "Please enter a real city or place name (e.g., 'Barcelona, Spain').", variant: "destructive" });
        setAiChecking(false);
        return;
      }
    }

    setAiChecking(false);
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    if (!canProceedFromStep(5)) return;

    // Validate location is real
    if (location.trim()) {
      setLoading(true);
      const locationResult = await validateRealLocation(location);
      if (!locationResult.valid) {
        toast({ title: "Invalid location", description: "Please enter a real city or place name.", variant: "destructive" });
        setLoading(false);
        return;
      }
    }

    setLoading(true);

    try {
      let finalAvatarUrl = null;
      const safeDisplayName = displayName.trim() || (user.email ? user.email.split("@")[0] : "Traveler");

      // Upload avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/avatar.${fileExt}`;

        const { publicUrl } = await uploadAndModerate("avatars", fileName, avatarFile, { upsert: true });
        finalAvatarUrl = publicUrl;
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: safeDisplayName,
          avatar_url: finalAvatarUrl,
          bio: bio.trim() || null,
          interests: interests.length > 0 ? interests : null,
          location: location.trim() || null,
          is_local: isLocal,
          languages: languages.length > 0 ? languages : [],
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Mark onboarding as complete in cache — do NOT invalidate to avoid race condition
      queryClient.setQueryData(["onboarding-check", user.id], false);
      // Refresh profile data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["userProfile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
      ]);

      track("onboarding_complete", {
        has_avatar: !!finalAvatarUrl,
        interests_count: interests.length,
        is_local: isLocal,
      });

      toast({
        title: "Welcome to Travela! 🎉",
        description: "Your profile is all set up.",
      });

      navigate("/home", { replace: true });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/home");
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <Plane className="w-10 h-10 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Welcome to Travela!</h2>
              <p className="text-muted-foreground mt-2">
                Let's set up your profile so you can start connecting with locals and travelers.
              </p>
            </div>
            <div className="space-y-3 text-left max-w-xs mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm">Add a profile photo</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm">Tell us about yourself</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm">Select your interests</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm">Set your location</span>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <h2 className="text-xl font-display font-semibold">Add a Profile Photo</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Help others recognize you with a friendly photo
              </p>
            </div>
            
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className={cn("w-32 h-32 ring-4 ring-primary/20", avatarChecking && "opacity-50")}>
                  <AvatarImage src={avatarUrl || ""} />
                  <AvatarFallback className="text-4xl bg-muted">
                    {displayName ? displayName[0].toUpperCase() : <User className="w-12 h-12" />}
                  </AvatarFallback>
                </Avatar>
                {avatarChecking && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarSelect}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  size="icon"
                  className="absolute -bottom-2 -right-2 rounded-full h-10 w-10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarChecking}
                >
                  <Camera className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Display Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="What should we call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                required
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <h2 className="text-xl font-display font-semibold">About You</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Share a bit about yourself and the languages you speak
              </p>
            </div>

            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                placeholder="Tell travelers about yourself, your hobbies, and what you'd love to share..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[120px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {bio.length}/500
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Languages I Speak
              </Label>
              <Select value={selectedLanguage} onValueChange={addLanguageFromDropdown}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a language..." />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-background z-50">
                  {COMMON_LANGUAGES.filter(l => !languages.includes(l)).map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                  <SelectItem value="__other__">Other (type your own)</SelectItem>
                </SelectContent>
              </Select>
              {showOtherLanguage && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your language..."
                    value={languageInput}
                    onChange={(e) => setLanguageInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCustomLanguage())}
                  />
                  <Button onClick={addCustomLanguage} variant="outline">Add</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {languages.map((lang) => (
                  <span
                    key={lang}
                    onClick={() => removeLanguage(lang)}
                    className="px-3 py-1 rounded-full text-sm bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors"
                  >
                    {lang} ×
                  </span>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <h2 className="text-xl font-display font-semibold">Your Interests <span className="text-destructive">*</span></h2>
              <p className="text-muted-foreground text-sm mt-1">
                Select at least 1 interest (up to 10) to help find the perfect matches
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {SUGGESTED_INTERESTS.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm transition-all",
                    interests.includes(interest)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  {interests.includes(interest) && <Check className="w-3 h-3 inline mr-1" />}
                  {interest}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Add Custom Interest</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Type your own interest..."
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCustomInterest())}
                />
                <Button onClick={addCustomInterest} variant="outline">Add</Button>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {interests.length}/20 selected
            </p>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <h2 className="text-xl font-display font-semibold">Your Location</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Let us know where you're based
              </p>
            </div>

            <div className="space-y-2">
              <Label>City / Location <span className="text-destructive">*</span></Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="e.g., Barcelona, Spain"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <Label className="text-base">I'm a Local Guide</Label>
                <p className="text-sm text-muted-foreground">
                  Enable to help travelers explore your area
                </p>
              </div>
              <Switch
                checked={isLocal}
                onCheckedChange={setIsLocal}
              />
            </div>

            {isLocal && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">
                  <Sparkles className="w-4 h-4 inline mr-1 text-primary" />
                  As a local guide, you'll appear in search results for travelers visiting {location || "your area"}.
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      {/* Back / Sign out button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>

      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                  step.id < currentStep && "bg-primary text-primary-foreground",
                  step.id === currentStep && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  step.id > currentStep && "bg-muted text-muted-foreground"
                )}
              >
                {step.id < currentStep ? <Check className="w-4 h-4" /> : step.id}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm text-muted-foreground">
                Step {currentStep} of {STEPS.length}
              </CardTitle>
              {currentStep > 1 && (
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip for now
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {renderStep()}

            <div className="flex gap-3 mt-6">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              
              {currentStep < STEPS.length ? (
                <Button onClick={handleNext} className="flex-1" disabled={aiChecking}>
                  {aiChecking ? "Checking..." : "Continue"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  onClick={handleComplete} 
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Complete Setup"}
                  <Check className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
