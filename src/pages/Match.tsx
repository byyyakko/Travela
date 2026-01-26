import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Heart, MapPin, Sparkles, RefreshCw, Search, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import VerifiedBadge from "@/components/VerifiedBadge";
import ReportBlockDialog from "@/components/ReportBlockDialog";

const Match = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [locationFilter, setLocationFilter] = useState("");

  // Fetch current user's age preferences
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("min_age_preference, max_age_preference")
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
        if (age === null) return true; // Show profiles without DOB
        return age >= minAge && age <= maxAge;
      });

      return filteredProfiles;
    },
    enabled: !!user && userProfile !== undefined && blockedUsers !== undefined,
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
    onSuccess: (data) => {
      if (data.matched) {
        toast({
          title: "🎉 It's a Match!",
          description: "You can now message each other.",
        });
      }
      setCurrentIndex((prev) => prev + 1);
    },
  });

  const currentProfile = filteredProfiles?.[currentIndex];

  const handleSwipe = (action: "like" | "pass") => {
    if (!currentProfile) return;
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

  return (
    <AppLayout>
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center mb-4">
          <h1 className={cn(
            "text-2xl font-display font-bold mb-2",
            theme === "anime" && "text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400"
          )}>
            Find Locals
          </h1>
          <p className={cn(
            theme === "anime" ? "text-purple-300" : "text-muted-foreground"
          )}>
            Swipe right to connect with locals in your destination
          </p>
        </div>

        {/* Location Search */}
        <div className="relative">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
            theme === "anime" ? "text-purple-400" : "text-muted-foreground"
          )} />
          <Input
            placeholder="Search by location..."
            value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setCurrentIndex(0); }}
            className={cn(
              "pl-9",
              theme === "cutesy" && "bg-pink-50 border-pink-200",
              theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white placeholder:text-purple-400"
            )}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-20">
            <div className={cn(
              "inline-block w-12 h-12 border-4 border-t-transparent rounded-full animate-spin",
              theme === "minimalist" && "border-primary",
              theme === "cutesy" && "border-pink-400",
              theme === "anime" && "border-cyan-400"
            )} />
          </div>
        ) : !currentProfile ? (
          <Card className={cn(
            "p-12 text-center",
            theme === "cutesy" && "bg-pink-50 border-pink-200",
            theme === "anime" && "bg-purple-900/50 border-purple-500/30"
          )}>
            <Sparkles className={cn(
              "w-16 h-16 mx-auto mb-4",
              theme === "minimalist" && "text-muted-foreground",
              theme === "cutesy" && "text-pink-300",
              theme === "anime" && "text-purple-400"
            )} />
            <h3 className={cn(
              "text-xl font-display font-semibold mb-2",
              theme === "anime" && "text-white"
            )}>
              No More Locals
            </h3>
            <p className={cn(
              "mb-6",
              theme === "anime" ? "text-purple-300" : "text-muted-foreground"
            )}>
              You've seen all available locals. Check back later!
            </p>
            <Button onClick={handleRefresh} className={cn(
              theme === "cutesy" && "bg-pink-500 hover:bg-pink-600",
              theme === "anime" && "bg-gradient-to-r from-pink-500 to-cyan-500"
            )}>
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
              <Card className={cn(
                "overflow-hidden",
                theme === "cutesy" && "border-pink-200 shadow-pink-100",
                theme === "anime" && "border-purple-500/30 bg-purple-900/50"
              )}>
                {/* Profile Image */}
                <div className={cn(
                  "aspect-[3/4] relative",
                  theme === "cutesy" && "bg-gradient-to-br from-pink-100 to-purple-100",
                  theme === "anime" && "bg-gradient-to-br from-purple-800 to-slate-900"
                )}>
                  {/* Report/Block Button */}
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
                        <AvatarFallback className={cn(
                          "text-4xl",
                          theme === "cutesy" && "bg-pink-200 text-pink-600",
                          theme === "anime" && "bg-purple-700 text-cyan-400"
                        )}>
                          {(currentProfile.display_name || "L")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                  {/* Profile info */}
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
                        {currentProfile.interests.slice(0, 4).map((interest, i) => (
                          <span
                            key={i}
                            className={cn(
                              "px-2 py-1 rounded-full text-xs",
                              theme === "minimalist" && "bg-white/20",
                              theme === "cutesy" && "bg-pink-400/50",
                              theme === "anime" && "bg-cyan-500/30 border border-cyan-400/50"
                            )}
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                    {currentProfile.languages && currentProfile.languages.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 text-white/70 text-xs">
                        <Globe className="w-3 h-3" />
                        <span>{currentProfile.languages.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className={cn(
                  "p-6 flex justify-center gap-6",
                  theme === "anime" && "bg-purple-900/80"
                )}>
                  <Button
                    size="lg"
                    variant="outline"
                    className={cn(
                      "w-16 h-16 rounded-full",
                      theme === "cutesy" && "border-pink-300 hover:bg-pink-50",
                      theme === "anime" && "border-purple-500 hover:bg-purple-800 text-purple-300"
                    )}
                    onClick={() => handleSwipe("pass")}
                    disabled={matchMutation.isPending}
                  >
                    <X className="w-8 h-8" />
                  </Button>

                  <Button
                    size="lg"
                    className={cn(
                      "w-16 h-16 rounded-full",
                      theme === "minimalist" && "bg-primary hover:bg-primary/90",
                      theme === "cutesy" && "bg-pink-500 hover:bg-pink-600",
                      theme === "anime" && "bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600"
                    )}
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
      </div>
    </AppLayout>
  );
};

export default Match;
