import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { X, Heart, MapPin, Sparkles, RefreshCw, Search, MessageCircle, Users, Globe, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import VerifiedBadge from "@/components/VerifiedBadge";
import ReportBlockDialog from "@/components/ReportBlockDialog";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useNavigate } from "react-router-dom";

const SWIPE_THRESHOLD = 100;

const Match = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { track } = useAnalytics("match");
  const [activeTab, setActiveTab] = useState("discover");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [locationFilter, setLocationFilter] = useState("");
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);
  const [likePopup, setLikePopup] = useState<{
    show: boolean;
    type: "liked" | "matched";
    profileName: string;
    avatarUrl: string | null;
  }>({ show: false, type: "liked", profileName: "", avatarUrl: null });

  // Swipe motion
  const motionX = useMotionValue(0);
  const rotate = useTransform(motionX, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(motionX, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(motionX, [-SWIPE_THRESHOLD, 0], [1, 0]);

  // Backend URL for ML ranking
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

  // Fetch current user's full profile
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const calculateAge = (dateOfBirth: string | null): number | null => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Fetch blocked users
  const { data: blockedUsers } = useQuery({
    queryKey: ["blockedUsers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("blocked_users")
        .select("blocked_user_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map(b => b.blocked_user_id) || [];
    },
    enabled: !!user,
  });

  // Fetch profiles to swipe on
  const { data: profiles, isLoading, refetch } = useQuery({
    queryKey: ["matchProfiles", user?.id, userProfile?.min_age_preference, userProfile?.max_age_preference, blockedUsers],
    queryFn: async () => {
      if (!user) return [];
      const { data: swipedData } = await supabase
        .from("matches")
        .select("target_user_id")
        .eq("user_id", user.id);

      const swipedIds = swipedData?.map(s => s.target_user_id) || [];
      const blockedIds = blockedUsers || [];
      const excludeIds = [...new Set([...swipedIds, ...blockedIds, user.id])];

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", `(${excludeIds.join(",")})`)
        .eq("is_local", true)
        .limit(50);

      if (error) throw error;

      const minAge = userProfile?.min_age_preference || 18;
      const maxAge = userProfile?.max_age_preference || 99;

      const filteredProfiles = (data || []).filter(profile => {
        const age = calculateAge(profile.date_of_birth);
        if (age === null) return true;
        return age >= minAge && age <= maxAge;
      });

      if (filteredProfiles.length > 0 && userProfile) {
        try {
          const res = await fetch(`${BACKEND_URL}/rank`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user: {
                user_id: user.id,
                date_of_birth: userProfile.date_of_birth,
                interests: userProfile.interests,
                location: userProfile.location,
              },
              candidates: filteredProfiles.map(p => ({
                user_id: p.user_id,
                display_name: p.display_name,
                date_of_birth: p.date_of_birth,
                interests: p.interests,
                location: p.location,
                bio: p.bio,
                is_local: p.is_local,
                is_verified: p.is_verified,
                avatar_url: p.avatar_url,
              })),
            }),
          });
          if (res.ok) {
            const { ranked } = await res.json();
            return ranked;
          }
        } catch {
          // Backend unavailable
        }
      }

      return filteredProfiles;
    },
    enabled: !!user && userProfile !== undefined && blockedUsers !== undefined,
  });

  // Fetch profile photos for discovered profiles
  const { data: allProfilePhotos } = useQuery({
    queryKey: ["profilePhotosForMatch", profiles?.map(p => p.user_id)],
    queryFn: async () => {
      if (!profiles || profiles.length === 0) return {};
      const userIds = profiles.map(p => p.user_id);
      const { data, error } = await supabase
        .from("profile_photos")
        .select("*")
        .in("user_id", userIds)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      (data || []).forEach(photo => {
        if (!map[photo.user_id]) map[photo.user_id] = [];
        map[photo.user_id].push(photo);
      });
      return map;
    },
    enabled: !!profiles && profiles.length > 0,
  });

  // Fetch profile prompts for discovered profiles
  const { data: allProfilePrompts } = useQuery({
    queryKey: ["profilePromptsForMatch", profiles?.map(p => p.user_id)],
    queryFn: async () => {
      if (!profiles || profiles.length === 0) return {};
      const userIds = profiles.map(p => p.user_id);
      const { data, error } = await supabase
        .from("profile_prompts")
        .select("*")
        .in("user_id", userIds)
        .order("display_order", { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      (data || []).forEach(prompt => {
        if (!map[prompt.user_id]) map[prompt.user_id] = [];
        map[prompt.user_id].push(prompt);
      });
      return map;
    },
    enabled: !!profiles && profiles.length > 0,
  });

  // Fetch profiles who liked the current user
  const { data: likedYouProfiles, isLoading: isLoadingLikedYou } = useQuery({
    queryKey: ["likedYouProfiles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: likers, error: likersError } = await supabase
        .from("matches")
        .select("user_id")
        .eq("target_user_id", user.id)
        .eq("action", "like");

      if (likersError) throw likersError;
      if (!likers || likers.length === 0) return [];

      const likerIds = likers.map(l => l.user_id);
      const { data: mutuals } = await supabase
        .from("mutual_matches")
        .select("user1_id, user2_id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const mutualUserIds = new Set(
        (mutuals || []).flatMap(m => [m.user1_id, m.user2_id]).filter(id => id !== user.id)
      );

      const pendingLikerIds = likerIds.filter(id => !mutualUserIds.has(id));
      if (pendingLikerIds.length === 0) return [];

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", pendingLikerIds);

      if (error) throw error;
      return profiles || [];
    },
    enabled: !!user,
  });

  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    if (!locationFilter.trim()) return profiles;
    const searchTerm = locationFilter.toLowerCase().trim();
    return profiles.filter(profile =>
      profile.location?.toLowerCase().includes(searchTerm)
    );
  }, [profiles, locationFilter]);

  const matchMutation = useMutation({
    mutationFn: async ({ targetUserId, action }: { targetUserId: string; action: "like" | "pass" }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("matches").insert({
        user_id: user.id,
        target_user_id: targetUserId,
        action,
      });
      if (error) throw error;

      if (action === "like") {
        const { data: mutual } = await supabase
          .from("mutual_matches")
          .select("id")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .or(`user1_id.eq.${targetUserId},user2_id.eq.${targetUserId}`)
          .maybeSingle();

        if (mutual) return { matched: true };
      }
      return { matched: false };
    },
    onSuccess: (data, variables) => {
      if (variables.action === "like") {
        const profile = currentProfile;
        if (data.matched) {
          track("mutual_match", { target_user_id: profile?.user_id });
          setLikePopup({
            show: true,
            type: "matched",
            profileName: profile?.display_name || "Local Guide",
            avatarUrl: profile?.avatar_url || null,
          });
        } else {
          setLikePopup({
            show: true,
            type: "liked",
            profileName: profile?.display_name || "Local Guide",
            avatarUrl: profile?.avatar_url || null,
          });
        }
      }
      setCurrentIndex((prev) => prev + 1);
      setCurrentPhotoIndex(0);
    },
  });

  const currentProfile = filteredProfiles?.[currentIndex];
  const currentPhotos = currentProfile ? allProfilePhotos?.[currentProfile.user_id] || [] : [];
  const currentPrompts = currentProfile ? allProfilePrompts?.[currentProfile.user_id] || [] : [];

  const handleSwipe = (action: "like" | "pass") => {
    if (!currentProfile) return;
    track(action === "like" ? "swipe_like" : "swipe_pass", {
      target_user_id: currentProfile.user_id,
      target_location: currentProfile.location,
    });
    matchMutation.mutate({ targetUserId: currentProfile.user_id, action });
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      handleSwipe("like");
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      handleSwipe("pass");
    }
  };

  const handleRefresh = () => {
    setCurrentIndex(0);
    refetch();
  };

  const handleBlock = () => {
    queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
    queryClient.invalidateQueries({ queryKey: ["matchProfiles"] });
    setCurrentIndex(prev => Math.min(prev, (filteredProfiles?.length || 1) - 1));
  };

  const closeLikePopup = () => {
    setLikePopup(prev => ({ ...prev, show: false }));
  };

  const openProfileDetail = () => {
    setDetailPhotoIndex(0);
    setShowProfileDetail(true);
  };

  // Get all photos for detail view (include avatar if no profile_photos)
  const getDetailPhotos = () => {
    if (!currentProfile) return [];
    if (currentPhotos.length > 0) return currentPhotos.map(p => p.photo_url);
    if (currentProfile.avatar_url) return [currentProfile.avatar_url];
    return [];
  };

  return (
    <AppLayout>
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-display font-bold mb-1">
            Find Locals
          </h1>
          <p className="text-muted-foreground text-sm">
            Swipe right to like, left to pass
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={cn("w-full grid", userProfile?.is_local ? "grid-cols-2" : "grid-cols-1")}>
            <TabsTrigger value="discover" className="gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Discover
            </TabsTrigger>
            {userProfile?.is_local && (
              <TabsTrigger value="liked-you" className="gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                Liked You
                {likedYouProfiles && likedYouProfiles.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-primary-foreground font-bold">
                    {likedYouProfiles.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="discover" className="space-y-4 mt-4">
            {/* Location Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by location..."
                value={locationFilter}
                onChange={(e) => { setLocationFilter(e.target.value); setCurrentIndex(0); }}
                className="pl-9 bg-secondary/50 border-primary/30"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-20">
                <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !currentProfile ? (
              <Card className="p-12 text-center bg-secondary/50 border-primary/30">
                <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary/60" />
                <h3 className="text-xl font-display font-semibold mb-2">
                  No More Locals
                </h3>
                <p className="text-muted-foreground mb-6">
                  You've seen all available locals. Check back later!
                </p>
                <Button onClick={handleRefresh} className="bg-primary hover:bg-primary/90">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </Card>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentProfile.id}
                  style={{ x: motionX, rotate }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDragEnd={handleDragEnd}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, x: -300 }}
                  transition={{ duration: 0.3 }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <Card className="overflow-hidden border-primary/30 shadow-primary/10 relative">
                    {/* Swipe indicators */}
                    <motion.div
                      style={{ opacity: likeOpacity }}
                      className="absolute top-8 left-6 z-20 px-4 py-2 border-4 border-primary rounded-lg rotate-[-20deg]"
                    >
                      <span className="text-primary font-bold text-2xl">LIKE</span>
                    </motion.div>
                    <motion.div
                      style={{ opacity: passOpacity }}
                      className="absolute top-8 right-6 z-20 px-4 py-2 border-4 border-destructive rounded-lg rotate-[20deg]"
                    >
                      <span className="text-destructive font-bold text-2xl">PASS</span>
                    </motion.div>

                    <div
                      className="aspect-[3/4] relative bg-gradient-to-br from-secondary to-accent/20"
                      onClick={openProfileDetail}
                    >
                      <ReportBlockDialog
                        targetUserId={currentProfile.user_id}
                        targetUserName={currentProfile.display_name || "this user"}
                        onBlock={handleBlock}
                      />
                      {/* Photo dots indicator */}
                      {currentPhotos.length > 1 && (
                        <div className="absolute top-3 left-0 right-0 z-10 flex justify-center gap-1 px-4">
                          {currentPhotos.map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1 rounded-full flex-1 max-w-8 transition-colors",
                                i === currentPhotoIndex ? "bg-white" : "bg-white/40"
                              )}
                            />
                          ))}
                        </div>
                      )}
                      {/* Photo tap zones */}
                      {currentPhotos.length > 1 && (
                        <>
                          <button
                            className="absolute left-0 top-0 w-1/3 h-full z-[5]"
                            onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(prev => Math.max(0, prev - 1)); }}
                          />
                          <button
                            className="absolute right-0 top-0 w-1/3 h-full z-[5]"
                            onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(prev => Math.min(currentPhotos.length - 1, prev + 1)); }}
                          />
                        </>
                      )}
                      {(() => {
                        const displayUrl = currentPhotos.length > 0
                          ? currentPhotos[currentPhotoIndex]?.photo_url
                          : currentProfile.avatar_url;
                        return displayUrl ? (
                          <img
                            src={displayUrl}
                            alt={currentProfile.display_name || "Profile"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Avatar className="w-32 h-32">
                              <AvatarFallback className="text-4xl bg-secondary text-primary">
                                {(currentProfile.display_name || "L")[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        );
                      })()}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white pointer-events-none">
                        <h2 className="text-2xl font-display font-bold flex items-center gap-2">
                          <span>
                            {currentProfile.display_name || "Local Guide"}
                            {currentProfile.date_of_birth && (
                              <span className="text-xl font-normal ml-2">
                                , {calculateAge(currentProfile.date_of_birth)}
                              </span>
                            )}
                          </span>
                          {currentProfile.is_verified && <VerifiedBadge size="lg" />}
                        </h2>
                        {currentProfile.location && (
                          <p className="flex items-center gap-1 mt-1 text-white/80">
                            <MapPin className="w-4 h-4" />
                            {currentProfile.location}
                          </p>
                        )}
                        {currentProfile.bio && (
                          <p className="mt-3 text-sm text-white/90 line-clamp-2">
                            {currentProfile.bio}
                          </p>
                        )}
                        {currentProfile.interests && currentProfile.interests.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {currentProfile.interests.slice(0, 4).map((interest: string, i: number) => (
                              <span key={i} className="px-2 py-1 rounded-full text-xs bg-white/20">
                                {interest}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-white/50 mt-3 text-center">Tap to view full profile</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </AnimatePresence>
            )}
          </TabsContent>

          <TabsContent value="liked-you" className="mt-4">
            {isLoadingLikedYou ? (
              <div className="text-center py-20">
                <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !likedYouProfiles || likedYouProfiles.length === 0 ? (
              <Card className="p-12 text-center bg-secondary/50 border-primary/30">
                <Users className="w-16 h-16 mx-auto mb-4 text-primary/60" />
                <h3 className="text-xl font-display font-semibold mb-2">
                  No Likes Yet
                </h3>
                <p className="text-muted-foreground">
                  When someone likes your profile, they'll appear here.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {likedYouProfiles.map((profile) => (
                  <Card
                    key={profile.id}
                    className="flex items-center gap-4 p-4 border-primary/30 hover:bg-secondary/30 transition-colors"
                  >
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={profile.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary text-primary text-lg">
                        {(profile.display_name || "L")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold flex items-center gap-1.5 truncate">
                        {profile.display_name || "Local Guide"}
                        {profile.date_of_birth && (
                          <span className="text-sm font-normal text-muted-foreground">
                            , {calculateAge(profile.date_of_birth)}
                          </span>
                        )}
                        {profile.is_verified && <VerifiedBadge size="sm" />}
                      </h3>
                      {profile.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {profile.location}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-9 h-9 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 p-0"
                        onClick={() => {
                          matchMutation.mutate({ targetUserId: profile.user_id, action: "pass" });
                          queryClient.invalidateQueries({ queryKey: ["likedYouProfiles"] });
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="w-9 h-9 rounded-full bg-primary hover:bg-primary/90 p-0"
                        onClick={() => {
                          matchMutation.mutate({ targetUserId: profile.user_id, action: "like" });
                          queryClient.invalidateQueries({ queryKey: ["likedYouProfiles"] });
                        }}
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Profile Detail Sheet */}
      <Sheet open={showProfileDetail} onOpenChange={setShowProfileDetail}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0">
          {currentProfile && (
            <ScrollArea className="h-full">
              <div className="pb-6">
                {/* Photo gallery */}
                <div className="relative aspect-square bg-muted">
                  {(() => {
                    const photos = getDetailPhotos();
                    const url = photos[detailPhotoIndex] || null;
                    return url ? (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary">
                        <Avatar className="w-32 h-32">
                          <AvatarFallback className="text-4xl bg-secondary text-primary">
                            {(currentProfile.display_name || "L")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    );
                  })()}
                  {getDetailPhotos().length > 1 && (
                    <div className="absolute top-3 left-0 right-0 z-10 flex justify-center gap-1 px-4">
                      {getDetailPhotos().map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setDetailPhotoIndex(i)}
                          className={cn(
                            "h-1 rounded-full flex-1 max-w-8 transition-colors",
                            i === detailPhotoIndex ? "bg-white" : "bg-white/40"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {getDetailPhotos().length > 1 && (
                    <>
                      <button
                        className="absolute left-0 top-0 w-1/3 h-full z-[5]"
                        onClick={() => setDetailPhotoIndex(prev => Math.max(0, prev - 1))}
                      />
                      <button
                        className="absolute right-0 top-0 w-1/3 h-full z-[5]"
                        onClick={() => setDetailPhotoIndex(prev => Math.min(getDetailPhotos().length - 1, prev + 1))}
                      />
                    </>
                  )}
                </div>

                <div className="p-5 space-y-5">
                  {/* Name & basics */}
                  <div>
                    <h2 className="text-2xl font-display font-bold flex items-center gap-2">
                      {currentProfile.display_name || "Local Guide"}
                      {currentProfile.date_of_birth && (
                        <span className="text-xl font-normal text-muted-foreground">
                          , {calculateAge(currentProfile.date_of_birth)}
                        </span>
                      )}
                      {currentProfile.is_verified && <VerifiedBadge size="lg" />}
                    </h2>
                    {currentProfile.location && (
                      <p className="flex items-center gap-1 mt-1 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {currentProfile.location}
                      </p>
                    )}
                  </div>

                  {/* Bio */}
                  {currentProfile.bio && (
                    <p className="text-foreground leading-relaxed">{currentProfile.bio}</p>
                  )}

                  {/* Languages */}
                  {currentProfile.languages && currentProfile.languages.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Speaks: {currentProfile.languages.join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Interests */}
                  {currentProfile.interests && currentProfile.interests.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Interests</h3>
                      <div className="flex flex-wrap gap-2">
                        {currentProfile.interests.map((interest: string, i: number) => (
                          <span key={i} className="px-3 py-1.5 rounded-full text-sm bg-secondary text-foreground">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prompts */}
                  {currentPrompts.length > 0 && (
                    <div className="space-y-3">
                      {currentPrompts.map((prompt) => (
                        <Card key={prompt.id} className="border-primary/20 bg-secondary/30">
                          <div className="p-4">
                            <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                              <Quote className="w-3 h-3" />
                              {prompt.question}
                            </p>
                            <p className="text-foreground">{prompt.answer}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-center gap-6 pt-4">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-16 h-16 rounded-full border-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => { setShowProfileDetail(false); handleSwipe("pass"); }}
                    >
                      <X className="w-8 h-8" />
                    </Button>
                    <Button
                      size="lg"
                      className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => { setShowProfileDetail(false); handleSwipe("like"); }}
                    >
                      <Heart className="w-8 h-8" />
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Like Sent / It's a Match Popup */}
      <Dialog open={likePopup.show} onOpenChange={(open) => !open && closeLikePopup()}>
        <DialogContent className="max-w-sm text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div className={cn(
              "relative w-24 h-24 rounded-full ring-4",
              likePopup.type === "matched" ? "ring-primary" : "ring-primary/40"
            )}>
              <Avatar className="w-24 h-24">
                <AvatarImage src={likePopup.avatarUrl || ""} />
                <AvatarFallback className="text-3xl bg-secondary text-primary">
                  {likePopup.profileName[0]?.toUpperCase() || "L"}
                </AvatarFallback>
              </Avatar>
              {likePopup.type === "matched" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                >
                  <Heart className="w-4 h-4 text-primary-foreground fill-current" />
                </motion.div>
              )}
            </div>

            {likePopup.type === "matched" ? (
              <>
                <h2 className="text-2xl font-display font-bold text-primary">
                  🎉 It's a Match!
                </h2>
                <p className="text-muted-foreground">
                  You and <span className="font-semibold text-foreground">{likePopup.profileName}</span> liked each other! You can now start chatting.
                </p>
                <div className="flex gap-3 w-full mt-2">
                  <Button variant="outline" className="flex-1" onClick={closeLikePopup}>
                    Keep Swiping
                  </Button>
                  <Button className="flex-1" onClick={() => { closeLikePopup(); navigate("/messages"); }}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                </div>
              </>
            ) : (
              <>
                <motion.div initial={{ y: 10 }} animate={{ y: 0 }}>
                  <Heart className="w-10 h-10 text-primary fill-primary/20 mx-auto mb-2" />
                </motion.div>
                <h2 className="text-xl font-display font-bold">Like Sent!</h2>
                <p className="text-muted-foreground text-sm">
                  You liked <span className="font-semibold text-foreground">{likePopup.profileName}</span>. If they like you back, you'll be able to message each other!
                </p>
                <Button className="w-full mt-2" onClick={closeLikePopup}>
                  Continue
                </Button>
              </>
            )}
          </motion.div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Match;
