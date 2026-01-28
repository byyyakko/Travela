import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/posts/PostCard";
import CreatePost from "@/components/posts/CreatePost";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, MapPin, Users, ChevronRight } from "lucide-react";
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
  "Welcome to Travela! Where are we going today?",
  "Hope you are having fun! Tell me more so I can guide you!",
  "Stay safe! Make sure you're all packed for your upcoming journey!",
  "Feed me! I'm hungry! Feed me some information on countries!",
];

const getRandomMessage = () => mascotMessages[Math.floor(Math.random() * mascotMessages.length)];

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
];

interface CutesyHomeProps {
  displayName?: string;
}

const CutesyHome = ({ displayName }: CutesyHomeProps) => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [mascotMessage] = useState(() => getRandomMessage());

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
              className="w-20 h-20 object-contain -mt-2 -mr-1 drop-shadow-md"
              animate={floatAnimation}
            />
          </div>
        </div>

        {/* Search bar with hand-drawn style */}
        <div className="relative mt-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Where would you like to visit?"
            className="pl-10 bg-background border-2 border-primary/50 rounded-full h-11 text-sm"
          />
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
        ) : posts?.length === 0 ? (
          <Card className="text-center py-12 cutesy-border bg-card/90">
            <motion.img 
              src={mascotCutesy} 
              alt="Cute cat mascot" 
              className="w-24 h-24 object-contain mx-auto mb-4 opacity-80"
              animate={floatAnimation}
            />
            <p className="text-muted-foreground">
              No posts yet. Be the first to share your travel experience! ✨
            </p>
          </Card>
        ) : (
          posts?.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onUpdate={refetch}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CutesyHome;
