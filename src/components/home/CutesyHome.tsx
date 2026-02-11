import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/posts/PostCard";
import CreatePost from "@/components/posts/CreatePost";
import DestinationSearch from "@/components/home/DestinationSearch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MapPin, Users, ChevronRight, Crown, Map as MapIcon, BookOpen, Sparkles, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import mascotCutesy from "@/assets/mascot-cutesy.png";

// Floating animation for mascot
const floatAnimation = {
  y: [0, -8, 0],
  transition: {
    duration: 2.5,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

// Random mascot messages
const mascotMessages = [
  "Hi! I am Tori-Tan! Nice to meet you hope I can be of help in any way!!",
  "Welcome to Travela! Where are we going today?",
  "Hope you are having fun! Tell me more so I can guide you!",
  "Stay safe! Make sure you're all packed for your upcoming journey!",
  "Feed me! I'm hungry! Feed me some information on countries!",
];

const TORI_TAN_GREETING = mascotMessages[0];
const getRandomMessage = () => mascotMessages[Math.floor(Math.random() * (mascotMessages.length - 1)) + 1];

// All available category flairs
export const allCategoryFlairs = [
  { label: "Local Favorites", color: "cutesy-pill-yellow" },
  { label: "Budget Friendly", color: "cutesy-pill-green" },
  { label: "Must See", color: "cutesy-pill-orange" },
  { label: "Foodie Finds", color: "cutesy-pill-pink" },
  { label: "Hidden Gems", color: "bg-violet-200 text-violet-900" },
  { label: "Adventure", color: "bg-sky-200 text-sky-900" },
  { label: "Nightlife", color: "bg-indigo-200 text-indigo-900" },
  { label: "Culture", color: "bg-rose-200 text-rose-900" },
  { label: "Nature", color: "bg-emerald-200 text-emerald-900" },
  { label: "Shopping", color: "bg-amber-200 text-amber-900" },
  { label: "Relaxation", color: "bg-teal-200 text-teal-900" },
  { label: "Photography", color: "bg-fuchsia-200 text-fuchsia-900" },
];

// The first 4 shown inline
const inlineCategoryFilters = allCategoryFlairs.slice(0, 4);

// Quick action icons
const quickActions = [
  { icon: Users, label: "Connect", path: "/match", paid: false },
  { icon: MapPin, label: "Plan", path: "/planner", paid: false },
  { icon: BookOpen, label: "Phrases", path: "/common-phrases", paid: false },
  { icon: Sparkles, label: "AI Trip", path: "/smart-itinerary", paid: true },
  { icon: MapIcon, label: "Map", path: "/map", paid: false },
  { icon: Crown, label: "Subscribe", path: "/subscription", paid: false },
];

// Map category labels to their pill CSS class for flair badges
export const categoryColorMap: Record<string, string> = Object.fromEntries(
  allCategoryFlairs.map(f => [f.label, f.color])
);

interface CutesyHomeProps {
  displayName?: string;
}

const CutesyHome = ({ displayName }: CutesyHomeProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showFlairsSheet, setShowFlairsSheet] = useState(false);
  const [showPaidDialog, setShowPaidDialog] = useState(false);
  const [hasSeenGreeting, setHasSeenGreeting] = useState(() => {
    return sessionStorage.getItem('toriTanGreeted') === 'true';
  });
  const [mascotMessage] = useState(() => {
    if (!hasSeenGreeting) {
      sessionStorage.setItem('toriTanGreeted', 'true');
      return TORI_TAN_GREETING;
    }
    return getRandomMessage();
  });

  const { data: subscriptionTier } = useQuery({
    queryKey: ["userSubscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return "tier_0";
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.subscription_tier || "tier_0";
    },
    enabled: !!user?.id,
  });

  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data: postsData, error } = await supabase
        .from("posts")
        .select(`
          *,
          post_likes (user_id),
          post_comments (id)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const userIds = [...new Set(postsData?.map(p => p.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, location")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      return postsData?.map(post => ({
        ...post,
        profiles: profilesMap.get(post.user_id) || null
      })) || [];
    },
  });

  const handleQuickAction = (action: typeof quickActions[0]) => {
    if (action.paid && subscriptionTier !== "tier_1" && subscriptionTier !== "tier_2") {
      setShowPaidDialog(true);
      return;
    }
    navigate(action.path);
  };

  return (
    <div className="space-y-6">
      {/* Personalized Greeting with dotted grid background */}
      <Card className="p-5 cutesy-grid-bg cutesy-border bg-card/95 relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary mb-1">
              Hello, {displayName || "Traveler"}! 👋
            </h1>
            <p className="text-muted-foreground text-sm">
              Where would you like to explore today?
          </p>
          </div>
          {/* Mascot with Speech Bubble */}
          <div className="relative flex items-start">
            {/* Speech Bubble */}
            <motion.div 
              className="absolute -left-36 top-0 bg-white border-2 border-primary/40 rounded-2xl px-3 py-2 shadow-md max-w-[140px]"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <p className="text-xs text-primary font-medium leading-snug">
                {mascotMessage}
              </p>
              {/* Speech bubble tail */}
              <div className="absolute -right-2 top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-white" />
              <div className="absolute -right-[10px] top-4 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-primary/40" style={{ zIndex: -1 }} />
            </motion.div>
            {/* Mascot */}
            <motion.img 
              src={mascotCutesy} 
              alt="Cute cat mascot" 
              className="w-20 h-20 object-contain -mt-2 -mr-1 drop-shadow-md mix-blend-multiply"
              animate={floatAnimation}
            />
          </div>
        </div>

        {/* Quick action icons */}
        <div className="flex justify-center gap-8 mt-6">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action)}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-secondary border-[3px] border-primary flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm relative">
                <action.icon className="w-7 h-7 text-primary" />
                {action.paid && subscriptionTier !== "tier_1" && subscriptionTier !== "tier_2" && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Lock className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold text-primary">{action.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Paid Feature Dialog */}
      <Dialog open={showPaidDialog} onOpenChange={setShowPaidDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Paid Feature</DialogTitle>
            <DialogDescription className="text-center text-base">
              Unlock <span className="font-semibold text-primary">Travela Plus</span> for smart AI itineraries, cultural translation, and more!
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <Button onClick={() => { setShowPaidDialog(false); navigate("/subscription"); }}>
              <Crown className="w-4 h-4 mr-2" />
              View Travela Plus — $5/mo
            </Button>
            <Button variant="outline" onClick={() => setShowPaidDialog(false)}>
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Destination Search with Premium Recommendations */}
      <DestinationSearch />

      {/* For You section with category filters */}
      <div>
        <h2 className="text-xl font-bold text-foreground cutesy-underline inline-block mb-4">
          For You
        </h2>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {inlineCategoryFilters.map((filter) => (
            <button
              key={filter.label}
              onClick={() => setActiveFilter(activeFilter === filter.label ? null : filter.label)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-semibold transition-all border-2 border-transparent",
                filter.color,
                activeFilter === filter.label && "ring-2 ring-primary ring-offset-2"
              )}
            >
              {filter.label}
            </button>
          ))}
          <button
            onClick={() => setShowFlairsSheet(true)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-muted text-muted-foreground flex items-center gap-1 hover:bg-muted/80 transition-colors"
          >
            More <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* All Flairs Sheet */}
      <Sheet open={showFlairsSheet} onOpenChange={setShowFlairsSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold">All Categories</SheetTitle>
          </SheetHeader>
          <div className="flex flex-wrap gap-2 mt-4 pb-4">
            {allCategoryFlairs.map((flair) => (
              <button
                key={flair.label}
                onClick={() => {
                  setActiveFilter(activeFilter === flair.label ? null : flair.label);
                  setShowFlairsSheet(false);
                }}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 border-transparent",
                  flair.color,
                  activeFilter === flair.label && "ring-2 ring-primary ring-offset-2"
                )}
              >
                {flair.label}
              </button>
            ))}
            {activeFilter && (
              <button
                onClick={() => {
                  setActiveFilter(null);
                  setShowFlairsSheet(false);
                }}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Clear Filter
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Post */}
      <CreatePost onPostCreated={refetch} />

      {/* Posts Feed */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !posts || posts.length === 0 ? (
          <Card className="text-center py-8 cutesy-border bg-card/90">
            <p className="text-muted-foreground">No posts yet. Be the first to share your travel experience! ✈️</p>
          </Card>
        ) : (() => {
          const filtered = activeFilter
            ? posts.filter((p: any) => p.category === activeFilter)
            : posts;
          return filtered.length === 0 ? (
            <Card className="text-center py-8 cutesy-border bg-card/90">
              <p className="text-muted-foreground">No posts matching "{activeFilter}". Try another category!</p>
            </Card>
          ) : (
            filtered.map((post: any) => (
              <PostCard
                key={post.id}
                post={post}
                category={post.category}
                currentUserId={user?.id}
                onUpdate={refetch}
              />
            ))
          );
        })()}
      </div>
    </div>
  );
};

export default CutesyHome;