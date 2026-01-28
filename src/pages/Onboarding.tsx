import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  User, Sparkles, Check, Globe
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else if (interests.length < 10) {
      setInterests([...interests, interest]);
    }
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim()) && interests.length < 10) {
      setInterests([...interests, customInterest.trim()]);
      setCustomInterest("");
    }
  };

  const addLanguage = () => {
    if (languageInput.trim() && !languages.includes(languageInput.trim())) {
      setLanguages([...languages, languageInput.trim()]);
      setLanguageInput("");
    }
  };

  const removeLanguage = (lang: string) => {
    setLanguages(languages.filter(l => l !== lang));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let finalAvatarUrl = null;

      // Upload avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        finalAvatarUrl = publicUrl;
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          avatar_url: finalAvatarUrl,
          bio: bio.trim() || null,
          interests: interests.length > 0 ? interests : null,
          location: location.trim() || null,
          is_local: isLocal,
          languages: languages.length > 0 ? languages : [],
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Welcome to Travela! 🎉",
        description: "Your profile is all set up.",
      });

      navigate("/home");
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
                <Avatar className="w-32 h-32 ring-4 ring-primary/20">
                  <AvatarImage src={avatarUrl || ""} />
                  <AvatarFallback className="text-4xl bg-muted">
                    {displayName ? displayName[0].toUpperCase() : <User className="w-12 h-12" />}
                  </AvatarFallback>
                </Avatar>
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
                >
                  <Camera className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="What should we call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
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
              <div className="flex gap-2">
                <Input
                  placeholder="Add a language..."
                  value={languageInput}
                  onChange={(e) => setLanguageInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addLanguage())}
                />
                <Button onClick={addLanguage} variant="outline">Add</Button>
              </div>
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
              <h2 className="text-xl font-display font-semibold">Your Interests</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Select up to 10 interests to help find the perfect matches
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
              {interests.length}/10 selected
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
              <Label>City / Location</Label>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
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
                <Button onClick={handleNext} className="flex-1">
                  Continue
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
