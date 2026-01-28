import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/posts/PostCard";
import CreatePost from "@/components/posts/CreatePost";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, MapPin, Users, Compass, ChevronRight } from "lucide-react";

const categoryFilters = [
  { label: "Local Favorites", variant: "default" },
  { label: "Budget Friendly", variant: "secondary" },
  { label: "Must See", variant: "accent" },
  { label: "Foodie Finds", variant: "muted" },
];

const quickActions = [
  { icon: Users, label: "Connect", path: "/match" },
  { icon: Compass, label: "Explore", path: "/home" },
  { icon: MapPin, label: "Plan", path: "/profile" },
];

interface MinimalistHomeProps {
  displayName?: string;
}

const MinimalistHome = ({ displayName }: MinimalistHomeProps) => {
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
    <div className="space-y-8">
      {/* Elegant greeting card */}
      <Card className="p-6 bg-card border border-border shadow-[var(--shadow-card)]">
        <h1 className="text-3xl font-bold text-foreground mb-1">
          Welcome back, {displayName || "Traveler"}
        </h1>
        <p className="text-muted-foreground">
          Discover your next adventure
        </p>

        {/* Clean search bar */}
        <div className="relative mt-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search destinations..."
            className="pl-12 bg-secondary/50 border-0 h-12 text-base focus-visible:ring-primary"
          />
        </div>

        {/* Refined quick actions */}
        <div className="flex justify-center gap-12 mt-8">
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.path}
              className="flex flex-col items-center gap-3 group"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center transition-all group-hover:shadow-lg group-hover:scale-105">
                <action.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">{action.label}</span>
            </a>
          ))}
        </div>
      </Card>

      {/* For You section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          For You
        </h2>

        {/* Elegant category pills */}
        <div className="flex flex-wrap gap-3 mb-6">
          {categoryFilters.map((filter) => (
            <button
              key={filter.label}
              onClick={() => setActiveFilter(activeFilter === filter.label ? null : filter.label)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all",
                activeFilter === filter.label
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {filter.label}
            </button>
          ))}
          <button className="px-5 py-2 rounded-full text-sm font-medium bg-muted text-muted-foreground flex items-center gap-1 hover:bg-muted/80 transition-colors">
            More <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create Post */}
      <CreatePost onPostCreated={refetch} />

      {/* Posts Feed */}
      <div className="space-y-5">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts?.length === 0 ? (
          <Card className="text-center py-16 bg-card border border-border">
            <p className="text-muted-foreground">
              No posts yet. Be the first to share your travel experience.
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

export default MinimalistHome;
