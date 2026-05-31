import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiGet, apiPost } from "@/lib/dataClient";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe, UserPlus, UserCheck, ArrowLeft, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import PostCard from "@/components/posts/PostCard";
import VerifiedBadge from "@/components/VerifiedBadge";
import ReportBlockDialog from "@/components/ReportBlockDialog";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isOwnProfile = user?.id === userId;

  // Redirect to own profile page if viewing self
  if (isOwnProfile) {
    navigate("/profile", { replace: true });
    return null;
  }

  // Fetch target user's profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["publicProfile", userId],
    queryFn: async () => {
      return apiGet(`/profiles/${userId}`);
    },
    enabled: !!userId,
  });

  // Fetch profile photos
  const { data: profilePhotos = [] } = useQuery({
    queryKey: ["publicProfilePhotos", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_photos")
        .select("*")
        .eq("user_id", userId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch user's posts
  const { data: posts = [], refetch: refetchPosts } = useQuery({
    queryKey: ["userPosts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, post_likes(user_id), post_comments(id)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch the profile for post cards
      const postsWithProfile = (data || []).map((post) => ({
        ...post,
        profiles: profile
          ? {
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              location: profile.location,
            }
          : null,
      }));
      return postsWithProfile;
    },
    enabled: !!userId && !!profile,
  });

  // Check if current user follows this user
  const { data: isFollowing } = useQuery({
    queryKey: ["isFollowing", user?.id, userId],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", userId!)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!userId,
  });

  // Follower/following counts
  const { data: followerCount = 0 } = useQuery({
    queryKey: ["followerCount", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId!);
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: followingCount = 0 } = useQuery({
    queryKey: ["followingCount", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId!);
      return count || 0;
    },
    enabled: !!userId,
  });

  // Follow/unfollow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !userId) throw new Error("Not authenticated");
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", user?.id, userId] });
      queryClient.invalidateQueries({ queryKey: ["followerCount", userId] });
      toast({ title: isFollowing ? "Unfollowed" : "Followed!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">User not found.</p>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Go back
          </Button>
        </div>
      </AppLayout>
    );
  }

  const displayName = profile.display_name || "Traveler";

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        {/* Profile header */}
        <Card className="p-6 cutesy-border">
          <div className="flex items-start gap-4">
            <Avatar className="w-20 h-20 ring-[3px] ring-primary">
              <AvatarImage src={profile.avatar_url || ""} />
              <AvatarFallback className="bg-secondary text-primary text-2xl font-bold">
                {displayName[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-display font-bold truncate">{displayName}</h1>
                {profile.is_verified && <VerifiedBadge />}
              </div>
              {profile.location && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="w-3.5 h-3.5" /> {profile.location}
                </p>
              )}
              {/* Stats row */}
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span><strong>{posts.length}</strong> posts</span>
                <span><strong>{followerCount}</strong> followers</span>
                <span><strong>{followingCount}</strong> following</span>
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>
          )}

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.interests.map((interest: string) => (
                <Badge key={interest} variant="secondary" className="text-xs">
                  {interest}
                </Badge>
              ))}
            </div>
          )}

          {/* Languages */}
          {profile.languages && profile.languages.length > 0 && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Globe className="w-3.5 h-3.5" />
              {profile.languages.join(", ")}
            </div>
          )}

          {/* Action buttons */}
          {user && !isOwnProfile && (
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                variant={isFollowing ? "outline" : "default"}
                className="flex-1 gap-2"
              >
                {isFollowing ? (
                  <><UserCheck className="w-4 h-4" /> Following</>
                ) : (
                  <><UserPlus className="w-4 h-4" /> Follow</>
                )}
              </Button>

              {isFollowing && (
                <Button
                  variant="secondary"
                  className="flex-1 gap-2"
                  onClick={async () => {
                    if (!user || !userId) return;
                    try {
                      // Create or find existing conversation via backend
                      await apiPost("/conversations", { other_user_id: userId });
                      navigate("/messages");
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    }
                  }}
                >
                  <MessageCircle className="w-4 h-4" /> Message
                </Button>
              )}
            </div>
          )}

          {/* Block / Report */}
          {user && !isOwnProfile && (
            <div className="mt-3 flex justify-end relative">
              <ReportBlockDialog
                targetUserId={userId!}
                targetUserName={displayName}
                onBlock={() => navigate(-1)}
              />
            </div>
          )}
        </Card>

        {/* User's posts */}
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold">Posts</h2>
          {posts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No posts yet.</p>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                category={post.category || undefined}
                currentUserId={user?.id}
                onUpdate={refetchPosts}
              />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default UserProfile;
