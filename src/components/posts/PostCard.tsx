import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Heart, MessageCircle, Bookmark, MapPin, MoreHorizontal, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    image_url: string | null;
    location_tag: string | null;
    created_at: string;
    user_id: string;
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
      location: string | null;
    } | null;
    post_likes: { user_id: string }[];
    post_comments: { id: string }[];
  };
  category?: string;
  currentUserId?: string;
  onUpdate: () => void;
}

const categoryColorMap: Record<string, string> = {
  "Local Favorites": "bg-yellow-200 text-yellow-900",
  "Budget Friendly": "bg-green-200 text-green-900",
  "Must See": "bg-orange-200 text-orange-900",
  "Foodie Finds": "bg-pink-200 text-pink-900",
};

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const PostCard = ({ post, category, currentUserId, onUpdate }: PostCardProps) => {
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(
    post.post_likes.some((like) => like.user_id === currentUserId)
  );
  const [likeCount, setLikeCount] = useState(post.post_likes.length);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const isOwnPost = currentUserId === post.user_id;
  const isDemo = false;

  // Fetch comments when expanded
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", post.id],
    queryFn: async () => {
      if (isDemo) return [];
      
      const { data, error } = await supabase
        .from("post_comments")
        .select("id, content, created_at, user_id")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch profiles for commenters
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(c => ({
        ...c,
        profile: profileMap.get(c.user_id) || null,
      })) as Comment[];
    },
    enabled: showComments && !isDemo,
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentUserId) throw new Error("Not authenticated");
      
      const { error } = await supabase.from("post_comments").insert({
        post_id: post.id,
        user_id: currentUserId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      onUpdate(); // Refresh post comment count
      toast({ title: "Comment added!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", currentUserId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      onUpdate();
      toast({ title: "Comment deleted" });
    },
  });

  // Check if post is bookmarked on mount
  useEffect(() => {
    const checkBookmark = async () => {
      if (!currentUserId || isDemo) return;
      
      const { data } = await supabase
        .from("post_bookmarks")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUserId)
        .maybeSingle();
      
      setIsBookmarked(!!data);
    };
    
    checkBookmark();
  }, [post.id, currentUserId, isDemo]);

  const handleLike = async () => {
    if (!currentUserId || isDemo) return;

    if (isLiked) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId);
      setLikeCount((prev) => prev - 1);
    } else {
      await supabase.from("post_likes").insert({
        post_id: post.id,
        user_id: currentUserId,
      });
      setLikeCount((prev) => prev + 1);
    }
    setIsLiked(!isLiked);
  };

  const handleBookmark = async () => {
    if (!currentUserId || isDemo) return;

    if (isBookmarked) {
      await supabase
        .from("post_bookmarks")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId);
      toast({
        title: "Removed from saved",
        description: "Post removed from your saved collection.",
      });
    } else {
      await supabase.from("post_bookmarks").insert({
        post_id: post.id,
        user_id: currentUserId,
      });
      toast({
        title: "Saved!",
        description: "Post added to your saved collection.",
      });
    }
    setIsBookmarked(!isBookmarked);
  };

  const handleDelete = async () => {
    if (!currentUserId || !isOwnPost) return;
    
    setIsDeleting(true);
    
    try {
      if (post.image_url) {
        const imagePath = post.image_url.split("/post-images/")[1];
        if (imagePath) {
          await supabase.storage.from("post-images").remove([imagePath]);
        }
      }

      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Your post has been deleted.",
      });
      
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isDemo) return;
    addCommentMutation.mutate(commentText.trim());
  };

  const displayName = post.profiles?.display_name || "Traveler";
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <>
      <Card className="overflow-hidden cutesy-border bg-card/95">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 ring-[3px] ring-primary">
              <AvatarImage src={post.profiles?.avatar_url || ""} />
              <AvatarFallback className="bg-secondary text-primary font-bold">
                {displayName[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">
                  {displayName}
                </p>
                {category && (
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    categoryColorMap[category] || "bg-muted text-muted-foreground"
                  )}>
                    {category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {timeAgo}
                </span>
                {post.location_tag && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-primary">
                      <MapPin className="w-3 h-3" />
                      {post.location_tag}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {isOwnPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <p className="whitespace-pre-wrap text-foreground">
            {post.content}
          </p>
        </div>

        {/* Image */}
        {post.image_url && (
          <div className="px-4 pb-3">
            <img
              src={post.image_url}
              alt="Post"
              className="w-full rounded-xl object-cover max-h-96 ring-[3px] ring-primary/40"
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-primary/30">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={cn(
                "gap-2",
                isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
              )}
            >
              <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
              {likeCount > 0 && likeCount}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
              className={cn(
                "gap-2",
                showComments ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              <MessageCircle className={cn("w-5 h-5", showComments && "fill-current")} />
              {post.post_comments.length > 0 && post.post_comments.length}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleBookmark}
            className={cn(
              isBookmarked ? "text-accent" : "text-muted-foreground hover:text-accent"
            )}
          >
            <Bookmark className={cn("w-5 h-5", isBookmarked && "fill-current")} />
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="px-4 pb-4 border-t border-primary/20">
            {/* Comments List */}
            <div className="space-y-3 mt-3 max-h-60 overflow-y-auto">
              {isDemo ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Comments are available on real posts. Create a post to start the conversation! 💬
                </p>
              ) : commentsLoading ? (
                <div className="flex justify-center py-3">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No comments yet. Be the first to comment! 💬
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <Avatar className="w-7 h-7 ring-2 ring-primary/30 flex-shrink-0">
                      <AvatarImage src={comment.profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary text-primary text-xs font-bold">
                        {(comment.profile?.display_name || "T")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="bg-secondary/60 rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-primary">
                          {comment.profile?.display_name || "Traveler"}
                        </p>
                        <p className="text-sm text-foreground break-words">
                          {comment.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                        {comment.user_id === currentUserId && (
                          <button
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                            className="text-[10px] text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            {!isDemo && currentUserId && (
              <form onSubmit={handleSubmitComment} className="flex items-center gap-2 mt-3">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 text-sm rounded-full border-primary/30 focus-visible:ring-primary"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  className="rounded-full w-9 h-9 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post
              and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PostCard;