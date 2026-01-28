import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRateLimit, RATE_LIMITS } from "@/hooks/useRateLimit";
import type { Tables } from "@/integrations/supabase/types";

// Sample demo profiles for testing when no real users exist
const DEMO_PROFILES: Partial<Tables<"profiles">>[] = [
  {
    id: "demo-1",
    user_id: "demo-user-1",
    email: "sofia@demo.com",
    display_name: "Sofia Martinez",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face",
    bio: "Born and raised in the Gothic Quarter. I'll show you the Barcelona tourists never see! Love tapas, hidden bars, and local markets.",
    location: "Barcelona, Spain",
    is_local: true,
    is_verified: true,
    interests: ["Tapas Tours", "Hidden Bars", "Local Markets", "Photography"],
    languages: ["Spanish", "English", "Catalan"],
    date_of_birth: "1995-03-15",
  },
  {
    id: "demo-2",
    user_id: "demo-user-2",
    email: "kenji@demo.com",
    display_name: "Kenji Tanaka",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    bio: "Food photographer by day, izakaya explorer by night. Let's find the best hidden ramen spots together!",
    location: "Tokyo, Japan",
    is_local: true,
    is_verified: true,
    interests: ["Ramen Spots", "Night Photography", "Sake Tasting", "Street Food"],
    languages: ["Japanese", "English"],
    date_of_birth: "1992-08-22",
  },
  {
    id: "demo-3",
    user_id: "demo-user-3",
    email: "amara@demo.com",
    display_name: "Amara Okonkwo",
    avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face",
    bio: "Third-generation spice merchant. I'll take you through the real Medina experience and share our family recipes.",
    location: "Marrakech, Morocco",
    is_local: true,
    is_verified: false,
    interests: ["Spice Markets", "Traditional Cuisine", "Artisan Crafts", "Tea Ceremonies"],
    languages: ["Arabic", "French", "English"],
    date_of_birth: "1990-11-08",
  },
  {
    id: "demo-4",
    user_id: "demo-user-4",
    email: "marco@demo.com",
    display_name: "Marco Rossi",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face",
    bio: "Chef and history buff. Discover Rome through its food and forgotten stories. Pasta making is my passion!",
    location: "Rome, Italy",
    is_local: true,
    is_verified: true,
    interests: ["Pasta Making", "Wine Cellars", "Ancient History", "Local Trattorias"],
    languages: ["Italian", "English"],
    date_of_birth: "1988-06-30",
  },
  {
    id: "demo-5",
    user_id: "demo-user-5",
    email: "priya@demo.com",
    display_name: "Priya Sharma",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face",
    bio: "From dabbawalas to dance bars, I know every corner of this incredible city. Let me show you the real Mumbai!",
    location: "Mumbai, India",
    is_local: true,
    is_verified: false,
    interests: ["Street Food", "Bollywood Tours", "Temple Visits", "Markets"],
    languages: ["Hindi", "English", "Marathi"],
    date_of_birth: "1996-01-12",
  },
  {
    id: "demo-6",
    user_id: "demo-user-6",
    email: "lucas@demo.com",
    display_name: "Lucas Chen",
    avatar_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    bio: "Tech worker turned full-time food guide. My mission: find you the perfect xiaolongbao and bubble tea!",
    location: "Taipei, Taiwan",
    is_local: true,
    is_verified: true,
    interests: ["Night Markets", "Tea Culture", "Mountain Hikes", "Bubble Tea"],
    languages: ["Mandarin", "English"],
    date_of_birth: "1993-09-25",
  },
];
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
  const { checkRateLimit } = useRateLimit();
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

      // If no real profiles found, return demo profiles for testing
      if (filteredProfiles.length === 0) {
        return DEMO_PROFILES as Tables<"profiles">[];
      }

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

  // Check if we're viewing demo profiles
  const isDemo = filteredProfiles?.some(p => p.id?.startsWith("demo-"));

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

  const handleSwipe = async (action: "like" | "pass") => {
    if (!currentProfile) return;
    
    // For demo profiles, just move to next without saving
    if (currentProfile.id?.startsWith("demo-")) {
      if (action === "like") {
        toast({
          title: "Demo Mode",
          description: "This is a sample profile. Real matches will be saved when you find actual locals!",
        });
      }
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    // Check rate limit for real profiles
    const allowed = await checkRateLimit(RATE_LIMITS.MATCH_ACTION);
    if (!allowed) {
      toast({
        title: "Slow down!",
        description: "You're swiping too fast. Take a moment to review profiles.",
        variant: "destructive",
      });
      return;
    }
    
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
          {isDemo && (
            <p className={cn(
              "text-xs mt-2 px-3 py-1 rounded-full inline-block",
              theme === "minimalist" && "bg-amber-100 text-amber-700",
              theme === "cutesy" && "bg-pink-100 text-pink-600",
              theme === "anime" && "bg-purple-800/50 text-cyan-400 border border-cyan-500/30"
            )}>
              ✨ Demo Mode - Sample Profiles
            </p>
          )}
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
