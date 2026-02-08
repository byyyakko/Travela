import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/posts/PostCard";
import CreatePost from "@/components/posts/CreatePost";
import DestinationSearch from "@/components/home/DestinationSearch";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MapPin, Users, ChevronRight, Crown, Map as MapIcon, BookOpen, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
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

// Category filter pills with hand-drawn style colors
const categoryFilters = [
  { label: "Local Favorites", color: "cutesy-pill-yellow" },
  { label: "Budget Friendly", color: "cutesy-pill-green" },
  { label: "Must See", color: "cutesy-pill-orange" },
  { label: "Foodie Finds", color: "cutesy-pill-pink" },
];

// Quick action icons
const quickActions = [
  { icon: Users, label: "Connect", path: "/match" },
  { icon: MapPin, label: "Plan", path: "/planner" },
  { icon: BookOpen, label: "Phrases", path: "/common-phrases" },
  { icon: Sparkles, label: "AI Trip", path: "/smart-itinerary" },
  { icon: MapIcon, label: "Map", path: "/map" },
  { icon: Crown, label: "Subscribe", path: "/subscription" },
];

const DEMO_POSTS = [
  {
    id: "demo-post-1",
    content: "Just discovered the most amazing ramen spot in Shibuya! 🍜 The tonkotsu broth was simmered for 18 hours and the chashu melted in my mouth. If you're ever in Tokyo, this is a MUST visit!",
    image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=400&fit=crop",
    location_tag: "Tokyo, Japan",
    category: "Foodie Finds",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    user_id: "demo-user-1",
    profiles: {
      display_name: "Haruki",
      avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      location: "Tokyo, Japan",
    },
    post_likes: [{ user_id: "a" }, { user_id: "b" }, { user_id: "c" }],
    post_comments: [{ id: "c1" }, { id: "c2" }],
  },
  {
    id: "demo-post-2",
    content: "Caught the sunrise at Marina Bay Sands this morning ☀️ Singapore never gets old! The skyline reflecting off the water was absolutely magical. Who else is in SG right now?",
    image_url: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&h=400&fit=crop",
    location_tag: "Singapore",
    category: "Must See",
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    user_id: "demo-user-2",
    profiles: {
      display_name: "Mei Lin",
      avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      location: "Singapore",
    },
    post_likes: [{ user_id: "a" }, { user_id: "b" }, { user_id: "c" }, { user_id: "d" }, { user_id: "e" }],
    post_comments: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
  },
  {
    id: "demo-post-3",
    content: "Rice terraces in Ubud are unreal 🌾 Spent the whole day trekking through Tegallalang with a local guide. The views were breathtaking and the stories she shared about Balinese culture were priceless!",
    image_url: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&h=400&fit=crop",
    location_tag: "Bali, Indonesia",
    category: "Local Favorites",
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    user_id: "demo-user-3",
    profiles: {
      display_name: "Amara",
      avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=face",
      location: "Bali, Indonesia",
    },
    post_likes: [{ user_id: "a" }, { user_id: "b" }],
    post_comments: [{ id: "c1" }],
  },
  {
    id: "demo-post-4",
    content: "Pro tip: skip the touristy La Rambla restaurants and head to El Born for authentic tapas 🇪🇸 Had the best patatas bravas of my life at a tiny spot with only 6 tables. The locals know best!",
    location_tag: "Barcelona, Spain",
    category: "Budget Friendly",
    image_url: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    user_id: "demo-user-4",
    profiles: {
      display_name: "Sofia",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      location: "Barcelona, Spain",
    },
    post_likes: [{ user_id: "a" }, { user_id: "b" }, { user_id: "c" }, { user_id: "d" }],
    post_comments: [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }],
  },
];

// Map category labels to their pill CSS class for flair badges
const categoryColorMap: Record<string, string> = {
  "Local Favorites": "cutesy-pill-yellow",
  "Budget Friendly": "cutesy-pill-green",
  "Must See": "cutesy-pill-orange",
  "Foodie Finds": "cutesy-pill-pink",
};

interface CutesyHomeProps {
  displayName?: string;
}

const CutesyHome = ({ displayName }: CutesyHomeProps) => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
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
            <a
              key={action.label}
              href={action.path}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-secondary border-[3px] border-primary flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
                <action.icon className="w-7 h-7 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary">{action.label}</span>
            </a>
          ))}
        </div>
      </Card>

      {/* Destination Search with Premium Recommendations */}
      <DestinationSearch />

      {/* For You section with category filters */}
      <div>
        <h2 className="text-xl font-bold text-foreground cutesy-underline inline-block mb-4">
          For You
        </h2>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categoryFilters.map((filter) => (
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
          <button className="px-4 py-1.5 rounded-full text-sm font-semibold bg-muted text-muted-foreground flex items-center gap-1 hover:bg-muted/80 transition-colors">
            More <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Create Post */}
      <CreatePost onPostCreated={refetch} />

      {/* Posts Feed */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (() => {
          const allPosts = posts && posts.length > 0 ? posts : DEMO_POSTS;
          const filtered = activeFilter
            ? allPosts.filter((p: any) => p.category === activeFilter)
            : allPosts;
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
