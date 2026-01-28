import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import PostCard from "@/components/posts/PostCard";
import CreatePost from "@/components/posts/CreatePost";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Compass, TrendingUp } from "lucide-react";

const Home = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("forYou");

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

      // Fetch profiles for posts
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
    <AppLayout>
      <div className="space-y-6">
        <CreatePost onPostCreated={refetch} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={cn(
            "w-full grid grid-cols-2",
            theme === "cutesy" && "bg-secondary/80",
            theme === "anime" && "bg-card/80"
          )}>
            <TabsTrigger value="forYou" className={cn(
              "flex items-center gap-2",
              theme === "cutesy" && "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
              theme === "anime" && "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            )}>
              <Compass className="w-4 h-4" />
              For You
            </TabsTrigger>
            <TabsTrigger value="trending" className={cn(
              "flex items-center gap-2",
              theme === "cutesy" && "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
              theme === "anime" && "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            )}>
              <TrendingUp className="w-4 h-4" />
              Trending
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forYou" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : posts?.length === 0 ? (
              <div className={cn(
                "text-center py-12 rounded-xl",
                theme === "cutesy" && "bg-card/80",
                theme === "anime" && "bg-card/60"
              )}>
                <p className="text-muted-foreground">
                  No posts yet. Be the first to share your travel experience!
                </p>
              </div>
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
          </TabsContent>

          <TabsContent value="trending" className="space-y-4 mt-4">
            <div className={cn(
              "text-center py-12 rounded-xl",
              theme === "cutesy" && "bg-card/80",
              theme === "anime" && "bg-card/60"
            )}>
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Trending posts will appear here as the community grows!
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Home;
