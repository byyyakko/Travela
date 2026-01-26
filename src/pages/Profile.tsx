import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, ThemeStyle } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, MapPin, Sparkles, Heart, Zap, Check, Calendar, Users, Plane, Globe, Eye, Edit } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VerifiedBadge from "@/components/VerifiedBadge";
import ProfilePreview from "@/components/ProfilePreview";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const themes: { id: ThemeStyle; name: string; icon: React.ReactNode }[] = [
  { id: "minimalist", name: "Minimalist", icon: <Sparkles className="w-4 h-4" /> },
  { id: "cutesy", name: "Cutesy", icon: <Heart className="w-4 h-4" /> },
  { id: "anime", name: "Anime", icon: <Zap className="w-4 h-4" /> },
];

const Profile = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [isLocal, setIsLocal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [minAgePreference, setMinAgePreference] = useState(18);
  const [maxAgePreference, setMaxAgePreference] = useState(99);
  
  // Traveler-specific fields
  const [destination, setDestination] = useState("");
  const [travelStartDate, setTravelStartDate] = useState("");
  const [travelEndDate, setTravelEndDate] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState("");

  const { isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
        setLocation(data.location || "");
        setIsLocal(data.is_local || false);
        setIsVerified(data.is_verified || false);
        setInterests(data.interests || []);
        setAvatarUrl(data.avatar_url);
        setDateOfBirth(data.date_of_birth || "");
        setMinAgePreference(data.min_age_preference || 18);
        setMaxAgePreference(data.max_age_preference || 99);
        setDestination(data.destination || "");
        setTravelStartDate(data.travel_start_date || "");
        setTravelEndDate(data.travel_end_date || "");
        setLanguages(data.languages || []);
      }

      return data;
    },
    enabled: !!user,
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setAvatarUrl(publicUrl);
      
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      toast({ title: "Avatar updated!" });
    } catch (error: any) {
      toast({
        title: "Error uploading avatar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddInterest = () => {
    if (interestInput.trim() && !interests.includes(interestInput.trim())) {
      setInterests([...interests, interestInput.trim()]);
      setInterestInput("");
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
  };

  const handleAddLanguage = () => {
    if (languageInput.trim() && !languages.includes(languageInput.trim())) {
      setLanguages([...languages, languageInput.trim()]);
      setLanguageInput("");
    }
  };

  const handleRemoveLanguage = (language: string) => {
    setLanguages(languages.filter((l) => l !== language));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          location: location.trim() || null,
          is_local: isLocal,
          interests: interests.length > 0 ? interests : null,
          date_of_birth: dateOfBirth || null,
          min_age_preference: minAgePreference,
          max_age_preference: maxAgePreference,
          destination: destination.trim() || null,
          travel_start_date: travelStartDate || null,
          travel_end_date: travelEndDate || null,
          languages: languages.length > 0 ? languages : [],
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({ title: "Profile saved!" });
    } catch (error: any) {
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <div className={cn(
            "inline-block w-8 h-8 border-4 border-t-transparent rounded-full animate-spin",
            theme === "minimalist" && "border-primary",
            theme === "cutesy" && "border-pink-400",
            theme === "anime" && "border-cyan-400"
          )} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-lg mx-auto">
        <h1 className={cn(
          "text-2xl font-display font-bold text-center",
          theme === "anime" && "text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400"
        )}>
          Your Profile
        </h1>

        {/* Edit / Preview Tabs */}
        <Tabs defaultValue="edit" className="w-full">
          <TabsList className={cn(
            "grid w-full grid-cols-2",
            theme === "cutesy" && "bg-pink-100",
            theme === "anime" && "bg-purple-900/50 border border-purple-500/30"
          )}>
            <TabsTrigger 
              value="edit"
              className={cn(
                "flex items-center gap-2",
                theme === "cutesy" && "data-[state=active]:bg-pink-500 data-[state=active]:text-white",
                theme === "anime" && "data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white"
              )}
            >
              <Edit className="w-4 h-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger 
              value="preview"
              className={cn(
                "flex items-center gap-2",
                theme === "cutesy" && "data-[state=active]:bg-pink-500 data-[state=active]:text-white",
                theme === "anime" && "data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white"
              )}
            >
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab Content */}
          <TabsContent value="preview" className="mt-6">
            <div className="space-y-4">
              <p className={cn(
                "text-center text-sm",
                theme === "anime" ? "text-purple-300" : "text-muted-foreground"
              )}>
                This is how others see your profile
              </p>
              <ProfilePreview
                displayName={displayName}
                bio={bio}
                location={location}
                avatarUrl={avatarUrl}
                isLocal={isLocal}
                isVerified={isVerified}
                interests={interests}
                languages={languages}
                dateOfBirth={dateOfBirth}
                destination={destination}
                travelStartDate={travelStartDate}
                travelEndDate={travelEndDate}
              />
            </div>
          </TabsContent>

          {/* Edit Tab Content */}
          <TabsContent value="edit" className="mt-6 space-y-6">

        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar className={cn(
              "w-24 h-24",
              theme === "cutesy" && "ring-4 ring-pink-200",
              theme === "anime" && "ring-4 ring-purple-500"
            )}>
              <AvatarImage src={avatarUrl || ""} />
              <AvatarFallback className={cn(
                "text-2xl",
                theme === "cutesy" && "bg-pink-100 text-pink-600",
                theme === "anime" && "bg-purple-700 text-cyan-400"
              )}>
                {(displayName || user?.email || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                "absolute -bottom-2 -right-2 rounded-full h-8 w-8",
                theme === "cutesy" && "bg-pink-500 text-white hover:bg-pink-600",
                theme === "anime" && "bg-purple-600 text-white hover:bg-purple-700"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Profile Info */}
        <Card className={cn(
          theme === "cutesy" && "border-pink-200",
          theme === "anime" && "border-purple-500/30 bg-purple-900/50"
        )}>
          <CardHeader>
            <CardTitle className={cn(
              "text-lg",
              theme === "anime" && "text-white"
            )}>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Display Name</Label>
              <Input
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={cn(
                  theme === "cutesy" && "bg-pink-50 border-pink-200",
                  theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Date of Birth</Label>
              <div className="relative">
                <Calendar className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                  theme === "anime" ? "text-purple-400" : "text-muted-foreground"
                )} />
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                  className={cn(
                    "pl-9",
                    theme === "cutesy" && "bg-pink-50 border-pink-200",
                    theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                  )}
                />
              </div>
              <p className={cn(
                "text-xs",
                theme === "anime" ? "text-purple-400" : "text-muted-foreground"
              )}>
                You must be at least 18 years old
              </p>
            </div>

            <div className="space-y-2">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Bio</Label>
              <Textarea
                placeholder="Tell travelers about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className={cn(
                  "min-h-[100px]",
                  theme === "cutesy" && "bg-pink-50 border-pink-200",
                  theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Location</Label>
              <div className="relative">
                <MapPin className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                  theme === "anime" ? "text-purple-400" : "text-muted-foreground"
                )} />
                <Input
                  placeholder="Your city"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={cn(
                    "pl-9",
                    theme === "cutesy" && "bg-pink-50 border-pink-200",
                    theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                  )}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className={theme === "anime" ? "text-purple-200" : ""}>I'm a Local Guide</Label>
                <p className={cn(
                  "text-sm",
                  theme === "anime" ? "text-purple-400" : "text-muted-foreground"
                )}>
                  Enable to appear in local search
                </p>
              </div>
              <Switch
                checked={isLocal}
                onCheckedChange={setIsLocal}
                className={cn(
                  theme === "cutesy" && "data-[state=checked]:bg-pink-500",
                  theme === "anime" && "data-[state=checked]:bg-cyan-500"
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>Interests</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an interest..."
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddInterest())}
                  className={cn(
                    theme === "cutesy" && "bg-pink-50 border-pink-200",
                    theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                  )}
                />
                <Button onClick={handleAddInterest} variant="outline" className={cn(
                  theme === "cutesy" && "border-pink-200",
                  theme === "anime" && "border-purple-500/30 text-purple-300"
                )}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {interests.map((interest) => (
                  <span
                    key={interest}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm cursor-pointer",
                      theme === "minimalist" && "bg-primary/10 text-primary",
                      theme === "cutesy" && "bg-pink-100 text-pink-600",
                      theme === "anime" && "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    )}
                    onClick={() => handleRemoveInterest(interest)}
                  >
                    {interest} ×
                  </span>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-2">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>
                <Globe className="w-4 h-4 inline mr-2" />
                Languages I Speak
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a language..."
                  value={languageInput}
                  onChange={(e) => setLanguageInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddLanguage())}
                  className={cn(
                    theme === "cutesy" && "bg-pink-50 border-pink-200",
                    theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                  )}
                />
                <Button onClick={handleAddLanguage} variant="outline" className={cn(
                  theme === "cutesy" && "border-pink-200",
                  theme === "anime" && "border-purple-500/30 text-purple-300"
                )}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {languages.map((language) => (
                  <span
                    key={language}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm cursor-pointer",
                      theme === "minimalist" && "bg-secondary text-secondary-foreground",
                      theme === "cutesy" && "bg-purple-100 text-purple-600",
                      theme === "anime" && "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    )}
                    onClick={() => handleRemoveLanguage(language)}
                  >
                    {language} ×
                  </span>
                ))}
              </div>
            </div>

            {/* Verified Badge Display */}
            {isVerified && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg",
                theme === "minimalist" && "bg-blue-50",
                theme === "cutesy" && "bg-pink-50",
                theme === "anime" && "bg-cyan-500/10 border border-cyan-500/30"
              )}>
                <VerifiedBadge size="lg" />
                <span className={cn(
                  "font-medium",
                  theme === "anime" && "text-cyan-400"
                )}>
                  Verified Local Guide
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Traveler Info (for non-locals) */}
        {!isLocal && (
          <Card className={cn(
            theme === "cutesy" && "border-pink-200",
            theme === "anime" && "border-purple-500/30 bg-purple-900/50"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "text-lg flex items-center gap-2",
                theme === "anime" && "text-white"
              )}>
                <Plane className="w-5 h-5" />
                Travel Plans
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className={theme === "anime" ? "text-purple-200" : ""}>Destination City</Label>
                <div className="relative">
                  <MapPin className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                    theme === "anime" ? "text-purple-400" : "text-muted-foreground"
                  )} />
                  <Input
                    placeholder="Where are you traveling to?"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className={cn(
                      "pl-9",
                      theme === "cutesy" && "bg-pink-50 border-pink-200",
                      theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className={theme === "anime" ? "text-purple-200" : ""}>Start Date</Label>
                  <Input
                    type="date"
                    value={travelStartDate}
                    onChange={(e) => setTravelStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={cn(
                      theme === "cutesy" && "bg-pink-50 border-pink-200",
                      theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={theme === "anime" ? "text-purple-200" : ""}>End Date</Label>
                  <Input
                    type="date"
                    value={travelEndDate}
                    onChange={(e) => setTravelEndDate(e.target.value)}
                    min={travelStartDate || new Date().toISOString().split('T')[0]}
                    className={cn(
                      theme === "cutesy" && "bg-pink-50 border-pink-200",
                      theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white"
                    )}
                  />
                </div>
              </div>

              <p className={cn(
                "text-sm",
                theme === "anime" ? "text-purple-400" : "text-muted-foreground"
              )}>
                This helps locals in your destination city find you
              </p>
            </CardContent>
          </Card>
        )}

        {/* Age Preferences */}
        <Card className={cn(
          theme === "cutesy" && "border-pink-200",
          theme === "anime" && "border-purple-500/30 bg-purple-900/50"
        )}>
          <CardHeader>
            <CardTitle className={cn(
              "text-lg flex items-center gap-2",
              theme === "anime" && "text-white"
            )}>
              <Users className="w-5 h-5" />
              Match Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className={theme === "anime" ? "text-purple-200" : ""}>
                Age Range: {minAgePreference} - {maxAgePreference}
              </Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={theme === "anime" ? "text-purple-400" : "text-muted-foreground"}>Minimum Age</span>
                    <span className={cn(
                      "font-medium",
                      theme === "anime" && "text-cyan-400"
                    )}>{minAgePreference}</span>
                  </div>
                  <Slider
                    value={[minAgePreference]}
                    onValueChange={(value) => {
                      const newMin = Math.max(18, value[0]);
                      setMinAgePreference(newMin);
                      if (newMin > maxAgePreference) {
                        setMaxAgePreference(newMin);
                      }
                    }}
                    min={18}
                    max={99}
                    step={1}
                    className={cn(
                      theme === "cutesy" && "[&_[role=slider]]:bg-pink-500",
                      theme === "anime" && "[&_[role=slider]]:bg-cyan-500"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={theme === "anime" ? "text-purple-400" : "text-muted-foreground"}>Maximum Age</span>
                    <span className={cn(
                      "font-medium",
                      theme === "anime" && "text-cyan-400"
                    )}>{maxAgePreference}</span>
                  </div>
                  <Slider
                    value={[maxAgePreference]}
                    onValueChange={(value) => {
                      const newMax = Math.max(minAgePreference, value[0]);
                      setMaxAgePreference(newMax);
                    }}
                    min={18}
                    max={99}
                    step={1}
                    className={cn(
                      theme === "cutesy" && "[&_[role=slider]]:bg-pink-500",
                      theme === "anime" && "[&_[role=slider]]:bg-cyan-500"
                    )}
                  />
                </div>
              </div>
              <p className={cn(
                "text-sm",
                theme === "anime" ? "text-purple-400" : "text-muted-foreground"
              )}>
                You'll only see locals within this age range
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Theme Selection */}
        <Card className={cn(
          theme === "cutesy" && "border-pink-200",
          theme === "anime" && "border-purple-500/30 bg-purple-900/50"
        )}>
          <CardHeader>
            <CardTitle className={cn(
              "text-lg",
              theme === "anime" && "text-white"
            )}>App Theme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {themes.map((t) => (
                <Button
                  key={t.id}
                  variant={theme === t.id ? "default" : "outline"}
                  className={cn(
                    "flex-1 gap-2",
                    theme === t.id && t.id === "cutesy" && "bg-pink-500 hover:bg-pink-600",
                    theme === t.id && t.id === "anime" && "bg-gradient-to-r from-pink-500 to-cyan-500",
                    theme !== t.id && theme === "anime" && "border-purple-500/30 text-purple-300"
                  )}
                  onClick={() => setTheme(t.id)}
                >
                  {t.icon}
                  {t.name}
                  {theme === t.id && <Check className="w-4 h-4" />}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            className={cn(
              "w-full",
              theme === "cutesy" && "bg-pink-500 hover:bg-pink-600",
              theme === "anime" && "bg-gradient-to-r from-pink-500 to-cyan-500"
            )}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Profile"}
          </Button>

          <Button
            variant="outline"
            className={cn(
              "w-full",
              theme === "cutesy" && "border-pink-200 text-pink-600",
              theme === "anime" && "border-purple-500/30 text-purple-300"
            )}
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Profile;
