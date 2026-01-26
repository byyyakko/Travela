import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Bookmark, MapPin, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

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
  const { theme } = useTheme();
  const [isLiked, setIsLiked] = useState(
    post.post_likes.some((like) => like.user_id === currentUserId)
  );
  const [likeCount, setLikeCount] = useState(post.post_likes.length);
  const [isBookmarked, setIsBookmarked] = useState(false);

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
    } else {
      await supabase.from("post_bookmarks").insert({
        post_id: post.id,
        user_id: currentUserId,
      });
    }
    setIsBookmarked(!isBookmarked);
  };

  const displayName = post.profiles?.display_name || "Traveler";
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <Card className={cn(
      "overflow-hidden",
      theme === "cutesy" && "bg-white border-pink-200 shadow-pink-100",
      theme === "anime" && "bg-purple-900/50 border-purple-500/30"
    )}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className={cn(
            "w-10 h-10",
            theme === "cutesy" && "ring-2 ring-pink-200",
            theme === "anime" && "ring-2 ring-purple-500"
          )}>
            <AvatarImage src={post.profiles?.avatar_url || ""} />
            <AvatarFallback className={cn(
              theme === "cutesy" && "bg-pink-100 text-pink-600",
              theme === "anime" && "bg-purple-700 text-cyan-400"
            )}>
              {displayName[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className={cn(
              "font-medium",
              theme === "anime" && "text-white"
            )}>
              {displayName}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className={cn(
                theme === "anime" ? "text-purple-300" : "text-muted-foreground"
              )}>
                {timeAgo}
              </span>
              {post.location_tag && (
                <>
                  <span className={cn(
                    theme === "anime" ? "text-purple-500" : "text-muted-foreground"
                  )}>·</span>
                  <span className={cn(
                    "flex items-center gap-1",
                    theme === "minimalist" && "text-primary",
                    theme === "cutesy" && "text-pink-500",
                    theme === "anime" && "text-cyan-400"
                  )}>
                    <MapPin className="w-3 h-3" />
                    {post.location_tag}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className={cn(
          theme === "anime" && "text-purple-300 hover:text-white hover:bg-purple-800/50"
        )}>
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className={cn(
          "whitespace-pre-wrap",
          theme === "anime" && "text-purple-100"
        )}>
          {post.content}
        </p>
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="px-4 pb-3">
          <img
            src={post.image_url}
            alt="Post"
            className={cn(
              "w-full rounded-xl object-cover max-h-96",
              theme === "cutesy" && "ring-2 ring-pink-200",
              theme === "anime" && "ring-2 ring-purple-500/50"
            )}
          />
        </div>
      )}

      {/* Actions */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between border-t",
        theme === "cutesy" && "border-pink-100",
        theme === "anime" && "border-purple-500/20"
      )}>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={cn(
              "gap-2",
              isLiked && theme === "minimalist" && "text-red-500",
              isLiked && theme === "cutesy" && "text-pink-500",
              isLiked && theme === "anime" && "text-pink-400",
              !isLiked && theme === "anime" && "text-purple-300 hover:text-pink-400"
            )}
          >
            <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
            {likeCount > 0 && likeCount}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2",
              theme === "anime" && "text-purple-300 hover:text-cyan-400"
            )}
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
            isBookmarked && theme === "minimalist" && "text-primary",
            isBookmarked && theme === "cutesy" && "text-pink-500",
            isBookmarked && theme === "anime" && "text-cyan-400",
            !isBookmarked && theme === "anime" && "text-purple-300 hover:text-cyan-400"
          )}
        >
          <Bookmark className={cn("w-5 h-5", isBookmarked && "fill-current")} />
        </Button>
      </div>
    </Card>
  );
};

export default PostCard;
