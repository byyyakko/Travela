import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Heart, MessageCircle, Bookmark, MapPin, MoreHorizontal, Trash2 } from "lucide-react";
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
  currentUserId?: string;
  onUpdate: () => void;
}

const PostCard = ({ post, currentUserId, onUpdate }: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(
    post.post_likes.some((like) => like.user_id === currentUserId)
  );
  const [likeCount, setLikeCount] = useState(post.post_likes.length);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnPost = currentUserId === post.user_id;

  // Check if post is bookmarked on mount
  useEffect(() => {
    const checkBookmark = async () => {
      if (!currentUserId) return;
      
      const { data } = await supabase
        .from("post_bookmarks")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUserId)
        .maybeSingle();
      
      setIsBookmarked(!!data);
    };
    
    checkBookmark();
  }, [post.id, currentUserId]);

  const handleLike = async () => {
    if (!currentUserId) return;

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
    if (!currentUserId) return;

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
      // If post has an image, delete it from storage
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
              <p className="font-medium text-foreground">
                {displayName}
              </p>
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
              className="gap-2 text-muted-foreground hover:text-accent"
            >
              <MessageCircle className="w-5 h-5" />
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
