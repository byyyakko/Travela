import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { apiPost } from "@/lib/dataClient";
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Heart, MessageCircle, Bookmark, MapPin, MoreHorizontal, Trash2, Send, ChevronLeft, ChevronRight, X, UserPlus, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { containsProfanity } from "@/lib/profanity";
import { categoryColorMap } from "@/components/home/CutesyHome";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    image_url: string | null;
    image_urls?: string[] | null;
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

// Use shared color map, with fallback
const getCategoryColor = (cat: string) => categoryColorMap[cat] || "bg-muted text-muted-foreground";

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
  const navigate = useNavigate();
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
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Combine image_url and image_urls into one array
  const allImages: string[] = (() => {
    const urls: string[] = [];
    if (post.image_urls && post.image_urls.length > 0) {
      urls.push(...post.image_urls);
    } else if (post.image_url) {
      urls.push(post.image_url);
    }
    return urls;
  })();

  const isOwnPost = currentUserId === post.user_id;
  const isDemo = false;

  // Check if current user follows this post's author
  const { data: isFollowingAuthor } = useQuery({
    queryKey: ["isFollowing", currentUserId, post.user_id],
    queryFn: async () => {
      if (!currentUserId) return false;
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", currentUserId)
        .eq("following_id", post.user_id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentUserId && !isOwnPost,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Not authenticated");
      if (isFollowingAuthor) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", post.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: currentUserId, following_id: post.user_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", currentUserId, post.user_id] });
      toast({ title: isFollowingAuthor ? "Unfollowed" : "Followed!" });
    },
  });

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
      
      await apiPost(`/posts/${post.id}/comments`, { content });
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      onUpdate();
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

    await apiPost(`/posts/${post.id}/likes`);
    if (isLiked) {
      setLikeCount((prev) => prev - 1);
    } else {
      setLikeCount((prev) => prev + 1);
    }
    setIsLiked(!isLiked);
  };

  const handleBookmark = async () => {
    if (!currentUserId || isDemo) return;

    await apiPost(`/posts/${post.id}/bookmarks`);
    if (isBookmarked) {
      toast({
        title: "Removed from saved",
        description: "Post removed from your saved collection.",
      });
    } else {
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
      // Delete all images
      for (const url of allImages) {
        const imagePath = url.split("/post-images/")[1];
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
    if (containsProfanity(commentText)) {
      toast({ title: "Inappropriate content", description: "Your comment contains inappropriate language. Please revise it.", variant: "destructive" });
      return;
    }
    addCommentMutation.mutate(commentText.trim());
  };

  const displayName = post.profiles?.display_name || "Traveler";
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  const openFullscreen = (index: number) => {
    setFullscreenIndex(index);
    setFullscreenOpen(true);
  };

  return (
    <>
      <Card className="overflow-hidden cutesy-border bg-card/95">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate(isOwnPost ? '/profile' : `/user/${post.user_id}`)}
          >
            <Avatar className="w-10 h-10 ring-[3px] ring-primary">
              <AvatarImage src={post.profiles?.avatar_url || ""} />
              <AvatarFallback className="bg-secondary text-primary font-bold">
                {displayName[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground hover:underline">
                  {displayName}
                </p>
                {category && category.split(",").map((cat) => (
                  <span key={cat} className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    getCategoryColor(cat.trim())
                  )}>
                    {cat.trim()}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {timeAgo}
                </span>
                {post.location_tag && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span
                      className="flex items-center gap-1 text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="w-3 h-3" />
                      {post.location_tag}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Follow button */}
            {!isOwnPost && currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                className={cn(
                  "text-xs h-7 px-2",
                  isFollowingAuthor ? "text-muted-foreground" : "text-primary"
                )}
              >
                {isFollowingAuthor ? (
                  <UserCheck className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
              </Button>
            )}

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
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <p className="whitespace-pre-wrap text-foreground">
            {post.content}
          </p>
        </div>

        {/* Images - carousel if multiple, single if one */}
        {allImages.length > 0 && (
          <div className="px-4 pb-3">
            <div className="relative">
              <img
                src={allImages[currentImageIndex]}
                alt="Post"
                className="w-full rounded-xl cursor-pointer border-[3px] border-primary/20"
                onClick={() => openFullscreen(currentImageIndex)}
              />
              {/* Carousel controls */}
              {allImages.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i => i - 1); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border hover:bg-background"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  {currentImageIndex < allImages.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i => i + 1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border hover:bg-background"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  {/* Dots indicator */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i); }}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          i === currentImageIndex ? "bg-foreground scale-125" : "bg-foreground/40"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
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

      {/* Fullscreen Image Viewer */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden flex items-center justify-center">
          <button
            onClick={() => setFullscreenOpen(false)}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={allImages[fullscreenIndex]}
            alt="Fullscreen"
            className="max-w-full max-h-[90vh] object-contain"
          />
          {allImages.length > 1 && (
            <>
              {fullscreenIndex > 0 && (
                <button
                  onClick={() => setFullscreenIndex(i => i - 1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {fullscreenIndex < allImages.length - 1 && (
                <button
                  onClick={() => setFullscreenIndex(i => i + 1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setFullscreenIndex(i)}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-all",
                      i === fullscreenIndex ? "bg-white scale-125" : "bg-white/40"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
