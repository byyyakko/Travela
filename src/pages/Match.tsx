import { useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { X, Heart, MapPin, Sparkles, RefreshCw, Search, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import VerifiedBadge from "@/components/VerifiedBadge";
import ReportBlockDialog from "@/components/ReportBlockDialog";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useNavigate } from "react-router-dom";

const Match = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { track } = useAnalytics("match");
  const [activeTab, setActiveTab] = useState("discover");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [locationFilter, setLocationFilter] = useState("");
  const [likePopup, setLikePopup] = useState<{
    show: boolean;
    type: "liked" | "matched";
    profileName: string;
    avatarUrl: string | null;
  }>({ show: false, type: "liked", profileName: "", avatarUrl: null });

  // Backend URL for ML ranking (set in .env or defaults to local dev)
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

  // Fetch current user's full profile (age prefs + interests for ML ranking)
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

  // Calculate age from date of birth
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

  // Fetch profiles to swipe on (excluding self, already swiped, and blocked)
  const { data: profiles, isLoading, refetch } = useQuery({
    queryKey: ["matchProfiles", user?.id, userProfile?.min_age_preference, userProfile?.max_age_preference, blockedUsers],
    queryFn: async () => {
      if (!user) return [];

      // Get already swiped profiles
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

      // Filter by age preferences
      const minAge = userProfile?.min_age_preference || 18;
      const maxAge = userProfile?.max_age_preference || 99;

      const filteredProfiles = (data || []).filter(profile => {
        const age = calculateAge(profile.date_of_birth);
        if (age === null) return true;
        return age >= minAge && age <= maxAge;
      });

      // Rank profiles by ML compatibility (fallback to unranked if backend unavailable)
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
          // Backend unavailable — fall through to unranked profiles
        }
      }

      return filteredProfiles;
    },
    enabled: !!user && userProfile !== undefined && blockedUsers !== undefined,
  });

  // Fetch profiles who liked the current user
  const { data: likedYouProfiles, isLoading: isLoadingLikedYou } = useQuery({
    queryKey: ["likedYouProfiles", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user IDs who liked this user
      const { data: likers, error: likersError } = await supabase
        .from("matches")
        .select("user_id")
        .eq("target_user_id", user.id)
        .eq("action", "like");

      if (likersError) throw likersError;
      if (!likers || likers.length === 0) return [];

      const likerIds = likers.map(l => l.user_id);

      // Exclude mutual matches (already matched)
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

  // Filter profiles by location search
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

      // Check for mutual match
      if (action === "like") {
        const { data: mutual } = await supabase
          .from("mutual_matches")
          .select("id")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .or(`user1_id.eq.${targetUserId},user2_id.eq.${targetUserId}`)
          .maybeSingle();

        if (mutual) {
          return { matched: true };
        }
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
    },
  });

  const currentProfile = filteredProfiles?.[currentIndex];

  const handleSwipe = (action: "like" | "pass") => {
    if (!currentProfile) return;
    track(action === "like" ? "swipe_like" : "swipe_pass", {
      target_user_id: currentProfile.user_id,
      target_location: currentProfile.location,
    });
    matchMutation.mutate({ targetUserId: currentProfile.user_id, action });
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

  return (
    <AppLayout>
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-display font-bold mb-1">
            Find Locals
          </h1>
          <p className="text-muted-foreground text-sm">
            Connect with locals in your destination
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="discover" className="gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="liked-you" className="gap-1.5">
              <Heart className="w-3.5 h-3.5" />
              Liked You
              {likedYouProfiles && likedYouProfiles.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-primary-foreground font-bold">
                  {likedYouProfiles.length}
                </span>
              )}
            </TabsTrigger>
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
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, x: -300 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden border-primary/30 shadow-primary/10">
                    <div className="aspect-[3/4] relative bg-gradient-to-br from-secondary to-accent/20">
                      <ReportBlockDialog
                        targetUserId={currentProfile.user_id}
                        targetUserName={currentProfile.display_name || "this user"}
                        onBlock={handleBlock}
                      />
                      {currentProfile.avatar_url ? (
                        <img
                          src={currentProfile.avatar_url}
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
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
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
                          <p className="mt-3 text-sm text-white/90 line-clamp-3">
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
                      </div>
                    </div>
                    <div className="flex justify-center gap-6 p-6 bg-card">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-16 h-16 rounded-full border-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                        onClick={() => handleSwipe("pass")}
                        disabled={matchMutation.isPending}
                      >
                        <X className="w-8 h-8" />
                      </Button>
                      <Button
                        size="lg"
                        className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => handleSwipe("like")}
                        disabled={matchMutation.isPending}
                      >
                        <Heart className="w-8 h-8" />
                      </Button>
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
