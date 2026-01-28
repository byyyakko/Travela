import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/posts/PostCard";
import CreatePost from "@/components/posts/CreatePost";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, MapPin, Users, Compass, ChevronRight, Sparkles } from "lucide-react";
import bgAnime from "@/assets/bg-anime.png";

const categoryFilters = [
  { label: "Local Favorites", color: "bg-primary" },
  { label: "Budget Friendly", color: "bg-accent" },
  { label: "Must See", color: "bg-secondary text-secondary-foreground" },
  { label: "Foodie Finds", color: "bg-gradient-to-r from-primary to-accent" },
];

const quickActions = [
  { icon: Users, label: "Connect", path: "/match" },
  { icon: Compass, label: "Explore", path: "/home" },
  { icon: MapPin, label: "Plan", path: "/profile" },
];

interface AnimeHomeProps {
  displayName?: string;
}

const AnimeHome = ({ displayName }: AnimeHomeProps) => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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
    <div className="space-y-6 relative">
      {/* Anime-style hero card with background */}
      <Card className="relative overflow-hidden border-2 border-primary/30 bg-card/80 backdrop-blur-sm shadow-[var(--shadow-card)]">
        {/* Background image overlay */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url(${bgAnime})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-accent animate-pulse" />
            <span className="text-sm font-medium text-accent">おかえりなさい</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Hello, {displayName || "Traveler"}! ✨
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your adventure awaits
          </p>

          {/* Glowing search bar */}
          <div className="relative mt-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <Input
              placeholder="Where to next?"
              className="pl-10 bg-background/80 border-2 border-primary/40 rounded-xl h-11 text-sm focus-visible:ring-accent focus-visible:border-accent transition-all"
            />
          </div>

          {/* Anime-style quick actions with glow */}
          <div className="flex justify-center gap-8 mt-6">
            {quickActions.map((action) => (
              <a
                key={action.label}
                href={action.path}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center transition-transform group-hover:scale-110 border-2 border-primary-foreground/20">
                    <action.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                </div>
                <span className="text-xs font-bold text-foreground">{action.label}</span>
              </a>
            ))}
          </div>
        </div>
      </Card>

      {/* For You section with anime styling */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-foreground">
            For You
          </h2>
          <span className="text-accent">✦</span>
        </div>

        {/* Category filter pills with anime colors */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categoryFilters.map((filter) => (
            <button
              key={filter.label}
              onClick={() => setActiveFilter(activeFilter === filter.label ? null : filter.label)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-semibold transition-all border-2",
                activeFilter === filter.label
                  ? "border-accent ring-2 ring-accent/50"
                  : "border-transparent",
                filter.color,
                "text-primary-foreground hover:scale-105"
              )}
            >
              {filter.label}
            </button>
          ))}
          <button className="px-4 py-1.5 rounded-full text-sm font-semibold bg-muted text-muted-foreground flex items-center gap-1 hover:bg-muted/80 transition-all hover:scale-105">
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
            <div className="inline-block w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts?.length === 0 ? (
          <Card className="text-center py-12 bg-card/80 backdrop-blur-sm border-2 border-primary/20">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-accent" />
            <p className="text-muted-foreground">
              No posts yet. Start your journey! ✨
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

export default AnimeHome;
