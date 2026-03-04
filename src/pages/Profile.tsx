import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/posts/PostCard";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, MapPin, Calendar, Users, Plane, Globe, Eye, Edit, Plus, X, ImageIcon, Quote, MessageSquare, Check } from "lucide-react";
import AvatarPickerDialog from "@/components/AvatarPickerDialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VerifiedBadge from "@/components/VerifiedBadge";
import ProfilePreview from "@/components/ProfilePreview";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { uploadAndModerate } from "@/lib/moderateImage";
import { validateRealLocation } from "@/lib/validateLocation";
import { containsProfanity, containsProfanityWithAI } from "@/lib/profanity";
import { COMMON_LANGUAGES } from "@/lib/languages";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MAX_PHOTOS = 6;
const MAX_PROMPTS = 3;

const GUIDE_PROMPTS = [
  "As your local guide, I'll show you...",
  "What's a hidden gem only locals know about?",
  "My favorite local food you have to try is...",
  "The best time to visit my city is...",
  "A perfect day here looks like...",
  "I love being a local guide because...",
];

const USER_PROMPTS = [
  "A hobby I could talk about for hours is...",
  "My ideal weekend looks like...",
  "Something I'm passionate about is...",
  "The most spontaneous thing I've done is...",
  "I geek out about...",
  "A life goal I'm working towards is...",
  "Something that makes me unique is...",
  "I feel most alive when...",
  "A simple pleasure I treasure is...",
  "My friends would describe me as...",
  "The best advice I ever received was...",
  "My perfect evening looks like...",
  "On my days off, you'll find me...",
  "My favorite travel memory is...",
  "One travel tip I always give is...",
];

const MyPostsTab = ({ userId }: { userId?: string }) => {
  const { data: myPosts = [], refetch } = useQuery({
    queryKey: ["myPosts", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("posts")
        .select("*, post_likes(user_id), post_comments(id)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch own profile for display
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, location")
        .eq("user_id", userId)
        .maybeSingle();

      return (data || []).map((post) => ({
        ...post,
        profiles: profile || null,
      }));
    },
    enabled: !!userId,
  });

  return (
    <TabsContent value="posts" className="mt-6 space-y-4">
      {myPosts.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          You haven't posted anything yet.
        </p>
      ) : (
        myPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            category={post.category || undefined}
            currentUserId={userId}
            onUpdate={refetch}
          />
        ))
      )}
    </TabsContent>
  );
};

const Profile = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [isLocal, setIsLocal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Fetch profile photos
  const { data: profilePhotos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ["profilePhotos", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("profile_photos")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (profilePhotos.length >= MAX_PHOTOS) {
      toast({ title: `Maximum ${MAX_PHOTOS} photos allowed`, variant: "destructive" });
      return;
    }

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/photo_${Date.now()}.${fileExt}`;

      const { publicUrl } = await uploadAndModerate("avatars", fileName, file, { upsert: true });

      const { error: insertError } = await supabase
        .from("profile_photos")
        .insert({
          user_id: user.id,
          photo_url: publicUrl,
          display_order: profilePhotos.length,
        });

      if (insertError) throw insertError;

      // If this is the first photo and no avatar, set it as avatar
      if (!avatarUrl) {
        setAvatarUrl(publicUrl);
        await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      }

      refetchPhotos();
      toast({ title: "Photo added!" });
    } catch (error: any) {
      toast({ title: "Error uploading photo", description: error.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    if (!user) return;
    try {
      await supabase.from("profile_photos").delete().eq("id", photoId);

      // If this was the avatar, update to next photo or null
      if (avatarUrl === photoUrl) {
        const remaining = profilePhotos.filter(p => p.id !== photoId);
        const newAvatar = remaining.length > 0 ? remaining[0].photo_url : null;
        setAvatarUrl(newAvatar);
        await supabase.from("profiles").update({ avatar_url: newAvatar }).eq("user_id", user.id);
      }

      refetchPhotos();
      toast({ title: "Photo removed" });
    } catch (error: any) {
      toast({ title: "Error removing photo", description: error.message, variant: "destructive" });
    }
  };

  const handleSetMainPhoto = async (photoUrl: string) => {
    if (!user) return;
    try {
      setAvatarUrl(photoUrl);
      await supabase.from("profiles").update({ avatar_url: photoUrl }).eq("user_id", user.id);
      toast({ title: "Main photo updated!" });
    } catch (error: any) {
      toast({ title: "Error updating main photo", description: error.message, variant: "destructive" });
    }
  };

  // Fetch profile prompts
  const { data: profilePrompts = [], refetch: refetchPrompts } = useQuery({
    queryKey: ["profilePrompts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("profile_prompts")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const [selectedPromptQuestion, setSelectedPromptQuestion] = useState("");
  const [promptAnswer, setPromptAnswer] = useState("");

  const allPrompts = isLocal ? [...GUIDE_PROMPTS, ...USER_PROMPTS] : USER_PROMPTS;
  const availablePrompts = allPrompts.filter(
    q => !profilePrompts.some(p => p.question === q)
  );

  const handleAddPrompt = async () => {
    if (!user || !selectedPromptQuestion || !promptAnswer.trim()) return;
    if (containsProfanity(promptAnswer)) {
      toast({ title: "Inappropriate content", description: "Your prompt answer contains inappropriate language.", variant: "destructive" });
      return;
    }
    if (profilePrompts.length >= MAX_PROMPTS) {
      toast({ title: `Maximum ${MAX_PROMPTS} prompts allowed`, variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("profile_prompts").insert({
        user_id: user.id,
        question: selectedPromptQuestion,
        answer: promptAnswer.trim(),
        display_order: profilePrompts.length,
      });
      if (error) throw error;
      setSelectedPromptQuestion("");
      setPromptAnswer("");
      refetchPrompts();
      toast({ title: "Prompt added!" });
    } catch (error: any) {
      toast({ title: "Error adding prompt", description: error.message, variant: "destructive" });
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    try {
      await supabase.from("profile_prompts").delete().eq("id", promptId);
      refetchPrompts();
      toast({ title: "Prompt removed" });
    } catch (error: any) {
      toast({ title: "Error removing prompt", description: error.message, variant: "destructive" });
    }
  };

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

      const { publicUrl } = await uploadAndModerate("avatars", fileName, file, { upsert: true });

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
      if (containsProfanity(interestInput)) {
        toast({ title: "Inappropriate content", description: "Your interest contains inappropriate language.", variant: "destructive" });
        return;
      }
      setInterests([...interests, interestInput.trim()]);
      setInterestInput("");
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
  };

  const [showOtherLanguage, setShowOtherLanguage] = useState(false);

  const handleAddLanguageFromDropdown = (lang: string) => {
    if (lang === "__other__") {
      setShowOtherLanguage(true);
      return;
    }
    if (lang && !languages.includes(lang)) {
      setLanguages([...languages, lang]);
    }
  };

  const handleAddCustomLanguage = () => {
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

  const handleAddLanguage = () => {
    handleAddCustomLanguage();
  };

  const handleRemoveLanguage = (language: string) => {
    setLanguages(languages.filter((l) => l !== language));
  };

  const handleSave = async () => {
    if (!user) return;

    // Local profanity checks
    const fieldsToCheck = [
      { value: displayName, name: "display name" },
      { value: bio, name: "bio" },
      { value: location, name: "location" },
      { value: destination, name: "destination" },
    ];
    for (const field of fieldsToCheck) {
      if (containsProfanity(field.value)) {
        toast({ title: "Inappropriate content", description: `Your ${field.name} contains inappropriate language. Please revise it.`, variant: "destructive" });
        return;
      }
    }
    if (interests.some(i => containsProfanity(i))) {
      toast({ title: "Inappropriate content", description: "One of your interests contains inappropriate language.", variant: "destructive" });
      return;
    }
    if (languages.some(l => containsProfanity(l))) {
      toast({ title: "Inappropriate content", description: "One of your languages contains inappropriate language.", variant: "destructive" });
      return;
    }

    // AI profanity check on all non-empty text fields
    const allTexts = [displayName, bio, location, destination, ...interests, ...languages].filter(t => t && t.trim().length > 0);
    if (allTexts.length > 0) {
      try {
        const results = await Promise.all(allTexts.map(t => containsProfanityWithAI(t)));
        if (results.some(r => r)) {
          toast({ title: "Inappropriate content detected", description: "Our content filter detected inappropriate language. Please revise your profile.", variant: "destructive" });
          return;
        }
      } catch { /* fail open */ }
    }

    // Validate locations are real places
    const locationsToValidate = [location, destination].filter(l => l && l.trim().length > 0);
    for (const loc of locationsToValidate) {
      const result = await validateRealLocation(loc);
      if (!result.valid) {
        toast({ title: "Invalid location", description: `"${loc}" doesn't appear to be a real place. Please enter a valid city or location.`, variant: "destructive" });
        return;
      }
    }

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
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-display font-bold text-center">
          Your Profile
        </h1>

        {/* Edit / Preview Tabs */}
        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-secondary">
            <TabsTrigger 
              value="edit"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Edit className="w-4 h-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger 
              value="preview"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger 
              value="posts"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MessageSquare className="w-4 h-4" />
              My Posts
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab Content */}
          <TabsContent value="preview" className="mt-6">
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
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

        {/* Avatar / Profile Picture */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Profile Picture
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose a preset avatar or upload your own photo.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="w-24 h-24 border-2 border-primary/30">
              <AvatarImage src={avatarUrl || undefined} alt="Profile" />
              <AvatarFallback className="bg-secondary text-muted-foreground text-2xl">
                {displayName ? displayName[0]?.toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAvatarPickerOpen(true)}
              >
                Choose Avatar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-1" />
                Upload Photo
              </Button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
          </CardContent>
        </Card>

        <AvatarPickerDialog
          open={avatarPickerOpen}
          onOpenChange={setAvatarPickerOpen}
          currentAvatar={avatarUrl}
          onAvatarChange={(url) => setAvatarUrl(url)}
        />

        {/* Photo Gallery */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Photos ({profilePhotos.length}/{MAX_PHOTOS})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add up to {MAX_PHOTOS} photos. Tap a photo to set as main.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {profilePhotos.map((photo) => (
                <div
                  key={photo.id}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                    avatarUrl === photo.photo_url
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-primary/40"
                  )}
                  onClick={() => handleSetMainPhoto(photo.photo_url)}
                >
                  <img
                    src={photo.photo_url}
                    alt="Profile photo"
                    className="w-full h-full object-cover"
                  />
                  {avatarUrl === photo.photo_url && (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary text-primary-foreground">
                      Main
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhoto(photo.id, photo.photo_url);
                    }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center hover:bg-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {profilePhotos.length < MAX_PHOTOS && (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="aspect-square rounded-lg border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-6 h-6" />
                      <span className="text-[10px]">Add Photo</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              type="file"
              ref={photoInputRef}
              onChange={handleAddPhoto}
              accept="image/*"
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Travel Prompts */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Travel Prompts ({profilePrompts.length}/{MAX_PROMPTS})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose up to {MAX_PROMPTS} prompts to show on your profile
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing prompts */}
            {profilePrompts.map((prompt) => (
              <div key={prompt.id} className="relative p-3 rounded-lg bg-secondary/50 border border-primary/20">
                <button
                  onClick={() => handleDeletePrompt(prompt.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center hover:bg-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1 pr-8">
                  <Quote className="w-3 h-3" />
                  {prompt.question}
                </p>
                <p className="text-sm text-foreground">{prompt.answer}</p>
              </div>
            ))}

            {/* Add new prompt */}
            {profilePrompts.length < MAX_PROMPTS && (
              <div className="space-y-3 p-3 rounded-lg border-2 border-dashed border-primary/20">
                <Select value={selectedPromptQuestion} onValueChange={setSelectedPromptQuestion}>
                  <SelectTrigger className="bg-secondary/50 border-primary/30">
                    <SelectValue placeholder="Choose a prompt..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePrompts.map((q) => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPromptQuestion && (
                  <>
                    <Textarea
                      placeholder="Write your answer..."
                      value={promptAnswer}
                      onChange={(e) => setPromptAnswer(e.target.value)}
                      className="min-h-[80px] bg-secondary/50 border-primary/30"
                      maxLength={300}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{promptAnswer.length}/300</span>
                      <Button
                        size="sm"
                        onClick={handleAddPrompt}
                        disabled={!promptAnswer.trim()}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Prompt
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-secondary/50 border-primary/30"
              />
            </div>

            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                  className="pl-9 bg-secondary/50 border-primary/30"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                You must be at least 18 years old
              </p>
            </div>

            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                placeholder="Tell travelers about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[100px] bg-secondary/50 border-primary/30"
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Your city"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-9 bg-secondary/50 border-primary/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>I'm a Local Guide</Label>
                <p className="text-sm text-muted-foreground">
                  Enable to appear in local search
                </p>
              </div>
              <Switch
                checked={isLocal}
                onCheckedChange={setIsLocal}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            <div className="space-y-2">
              <Label>Interests</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an interest..."
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddInterest())}
                  className="bg-secondary/50 border-primary/30"
                />
                <Button onClick={handleAddInterest} variant="outline" className="border-primary/30">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {interests.map((interest) => (
                  <span
                    key={interest}
                    className="px-3 py-1 rounded-full text-sm cursor-pointer bg-secondary text-primary"
                    onClick={() => handleRemoveInterest(interest)}
                  >
                    {interest} ×
                  </span>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-2">
              <Label>
                <Globe className="w-4 h-4 inline mr-2" />
                Languages I Speak
              </Label>
              <Select onValueChange={handleAddLanguageFromDropdown}>
                <SelectTrigger className="bg-secondary/50 border-primary/30">
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
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomLanguage())}
                    className="bg-secondary/50 border-primary/30"
                  />
                  <Button onClick={handleAddCustomLanguage} variant="outline" className="border-primary/30">
                    Add
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {languages.map((language) => (
                  <span
                    key={language}
                    className="px-3 py-1 rounded-full text-sm cursor-pointer bg-accent/20 text-accent"
                    onClick={() => handleRemoveLanguage(language)}
                  >
                    {language} ×
                  </span>
                ))}
              </div>
            </div>

            {/* Verified Badge Display */}
            {isVerified && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
                <VerifiedBadge size="lg" />
                <span className="font-medium">
                  Verified Local Guide
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Traveler Info (for non-locals) */}
        {!isLocal && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plane className="w-5 h-5" />
                Travel Plans
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Destination City</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Where are you traveling to?"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="pl-9 bg-secondary/50 border-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={travelStartDate}
                    onChange={(e) => setTravelStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="bg-secondary/50 border-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={travelEndDate}
                    onChange={(e) => setTravelEndDate(e.target.value)}
                    min={travelStartDate || new Date().toISOString().split('T')[0]}
                    className="bg-secondary/50 border-primary/30"
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This helps locals in your destination city find you
              </p>
            </CardContent>
          </Card>
        )}

        {/* Age Preferences */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Match Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label>
                Age Range: {minAgePreference} - {maxAgePreference}
              </Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Minimum Age</span>
                    <span className="font-medium">{minAgePreference}</span>
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
                    className="[&_[role=slider]]:bg-primary"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Maximum Age</span>
                    <span className="font-medium">{maxAgePreference}</span>
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
                    className="[&_[role=slider]]:bg-primary"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                You'll only see locals within this age range
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Profile"}
          </Button>

          <Button
            variant="outline"
            className="w-full border-primary/30 text-primary"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
          </TabsContent>

          {/* My Posts Tab Content */}
          <MyPostsTab userId={user?.id} />

        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Profile;
