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
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Camera, MapPin, User, Sparkles, Check, Globe, LogOut
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PRESET_AVATARS } from "@/components/AvatarPickerDialog";
import { useAnalytics } from "@/hooks/useAnalytics";
import { containsProfanity, containsProfanityWithAI } from "@/lib/profanity";
import { COMMON_LANGUAGES } from "@/lib/languages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [avatarChecking, setAvatarChecking] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [showOtherLanguage, setShowOtherLanguage] = useState(false);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    setAvatarFile(file);

    setAvatarChecking(true);
    try {
      const fileExt = file.name.split(".").pop();
      const tempFileName = `${user?.id}/temp_check_${Date.now()}.${fileExt}`;
      await uploadAndModerate("avatars", tempFileName, file, { upsert: true });
      await supabase.storage.from("avatars").remove([tempFileName]);
      toast({ title: "Photo accepted ✓", description: "Your photo passed our content check." });
    } catch (err: any) {
      setAvatarFile(null);
      setAvatarUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Photo rejected", description: err.message || "This image was flagged as inappropriate.", variant: "destructive" });
    } finally {
      setAvatarChecking(false);
    }
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim())) {
      if (containsProfanity(customInterest)) {
        toast({ title: "Inappropriate content", description: "Your interest contains inappropriate language.", variant: "destructive" });
        return;
      }
      setInterests([...interests, customInterest.trim()]);
      setCustomInterest("");
    }
  };

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

  const handleComplete = async () => {
    if (!user) return;

    // Validation
    if (avatarChecking) {
      toast({ title: "Please wait", description: "Your photo is being checked...", variant: "destructive" });
      return;
    }
    if (!displayName.trim()) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    if (containsProfanity(displayName)) {
      toast({ title: "Inappropriate content", description: "Your display name contains inappropriate language.", variant: "destructive" });
      return;
    }
    if (containsProfanity(bio)) {
      toast({ title: "Inappropriate content", description: "Your bio contains inappropriate language.", variant: "destructive" });
      return;
    }
    if (interests.length === 0) {
      toast({ title: "Please select at least 1 interest", variant: "destructive" });
      return;
    }
    if (interests.some(i => containsProfanity(i))) {
      toast({ title: "Inappropriate content", description: "One of your interests contains inappropriate language.", variant: "destructive" });
      return;
    }
    if (!location.trim()) {
      toast({ title: "Location is required", variant: "destructive" });
      return;
    }
    if (containsProfanity(location)) {
      toast({ title: "Inappropriate content", description: "Your location contains inappropriate language.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // AI profanity check
      const textsToCheck = [displayName, bio, location, ...interests.filter(i => !SUGGESTED_INTERESTS.includes(i)), ...languages].filter(t => t && t.trim().length > 0);
      if (textsToCheck.length > 0) {
        const results = await Promise.all(textsToCheck.map(t => containsProfanityWithAI(t)));
        if (results.some(r => r)) {
          toast({ title: "Inappropriate content detected", description: "Please remove any inappropriate language before proceeding.", variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      // Validate location
      const locationResult = await validateRealLocation(location);
      if (!locationResult.valid) {
        toast({ title: "Invalid location", description: "Please enter a real city or place name (e.g., 'Barcelona, Spain').", variant: "destructive" });
        setLoading(false);
        return;
      }

      let finalAvatarUrl = null;
      const safeDisplayName = displayName.trim() || (user.email ? user.email.split("@")[0] : "Traveler");

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/avatar.${fileExt}`;
        const { publicUrl } = await uploadAndModerate("avatars", fileName, avatarFile, { upsert: true });
        finalAvatarUrl = publicUrl;
      } else if (avatarUrl) {
        finalAvatarUrl = avatarUrl;
      }

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

      queryClient.setQueryData(["onboarding-check", user.id], false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["userProfile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
      ]);

      track("onboarding_complete", {
        has_avatar: !!finalAvatarUrl,
        interests_count: interests.length,
        is_local: isLocal,
      });

      toast({ title: "Welcome to Travela! 🎉", description: "Your profile is all set up." });
      navigate("/home", { replace: true });
    } catch (error: any) {
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background p-4 pb-24">
      {/* Sign out */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="fixed top-4 left-4 z-10 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>

      <div className="w-full max-w-md mx-auto pt-14 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">Create Your Profile</h1>
          <p className="text-muted-foreground text-sm">Fill in your details to get started</p>
        </div>

        <Card className="border-border/50 shadow-card">
          <CardContent className="pt-6 space-y-6">

            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className={cn("w-24 h-24 ring-4 ring-primary/20", avatarChecking && "opacity-50")}>
                  <AvatarImage src={avatarUrl || ""} />
                  <AvatarFallback className="text-3xl bg-muted">
                    {displayName ? displayName[0].toUpperCase() : <User className="w-10 h-10" />}
                  </AvatarFallback>
                </Avatar>
                {avatarChecking && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleAvatarSelect} accept="image/*" className="hidden" />
                <Button size="icon" className="absolute -bottom-1 -right-1 rounded-full h-8 w-8" onClick={() => fileInputRef.current?.click()} disabled={avatarChecking}>
                  <Camera className="w-4 h-4" />
                </Button>
              </div>

              {/* Preset avatars */}
              <div className="w-full space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or pick an avatar</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-6 gap-2 justify-items-center">
                  {PRESET_AVATARS.map((url) => {
                    const isSelected = avatarUrl === url;
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => { setAvatarUrl(url); setAvatarFile(null); }}
                        className={cn(
                          "relative rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary",
                          isSelected && "ring-2 ring-primary scale-110"
                        )}
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={url} alt="Preset avatar" />
                          <AvatarFallback>?</AvatarFallback>
                        </Avatar>
                        {isSelected && (
                          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Display Name */}
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

            {/* Bio */}
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                placeholder="Tell travelers about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[80px] resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
            </div>

            {/* Languages */}
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
              {languages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {languages.map((lang) => (
                    <span key={lang} onClick={() => removeLanguage(lang)} className="px-3 py-1 rounded-full text-sm bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors">
                      {lang} ×
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Interests */}
            <div className="space-y-3">
              <Label>Interests <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">Select at least 1 (up to 10)</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm transition-all",
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
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom interest..."
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCustomInterest())}
                />
                <Button onClick={addCustomInterest} variant="outline" size="sm">Add</Button>
              </div>
              {interests.length > 0 && (
                <p className="text-xs text-muted-foreground">{interests.length} selected</p>
              )}
            </div>

            {/* Location */}
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

            {/* Local Guide Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <Label className="text-base">I'm a Local Guide</Label>
                <p className="text-sm text-muted-foreground">Help travelers explore your area</p>
              </div>
              <Switch checked={isLocal} onCheckedChange={setIsLocal} />
            </div>

            {isLocal && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">
                  <Sparkles className="w-4 h-4 inline mr-1 text-primary" />
                  You'll appear in search results for travelers visiting {location || "your area"}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit button - fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
          <div className="max-w-md mx-auto">
            <Button onClick={handleComplete} className="w-full" size="lg" disabled={loading || avatarChecking}>
              {loading ? "Saving..." : "Complete Setup"}
              <Check className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
