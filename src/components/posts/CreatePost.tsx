import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImagePlus, MapPin, X, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CreatePostProps {
  onPostCreated: () => void;
}

const CreatePost = ({ onPostCreated }: CreatePostProps) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [content, setContent] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) return;
    if (!user) return;

    setLoading(true);

    try {
      let imageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: content.trim(),
        image_url: imageUrl,
        location_tag: locationTag.trim() || null,
      });

      if (error) throw error;

      setContent("");
      setLocationTag("");
      removeImage();
      onPostCreated();

      toast({
        title: "Posted!",
        description: "Your travel experience has been shared.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn(
      "p-4",
      theme === "cutesy" && "bg-card/90 border-primary/30",
      theme === "anime" && "bg-card/80 border-primary/30"
    )}>
      <div className="flex gap-3">
        <Avatar className={cn(
          "w-10 h-10",
          theme === "cutesy" && "ring-2 ring-primary/30",
          theme === "anime" && "ring-2 ring-primary/50"
        )}>
          <AvatarImage src="" />
          <AvatarFallback className="bg-primary/10 text-primary">
            {user?.email?.[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-3">
          <Textarea
            placeholder="Share your travel experience..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={cn(
              "min-h-[80px] resize-none",
              theme === "cutesy" && "bg-background border-primary/30 focus:border-primary",
              theme === "anime" && "bg-background border-primary/30 focus:border-primary"
            )}
          />

          {imagePreview && (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 rounded-lg object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={removeImage}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Add location..."
                value={locationTag}
                onChange={(e) => setLocationTag(e.target.value)}
                className={cn(
                  "pl-9",
                  theme === "cutesy" && "bg-background border-primary/30",
                  theme === "anime" && "bg-background border-primary/30"
                )}
              />
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />

            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                theme === "cutesy" && "border-primary/30 text-primary hover:bg-primary/10",
                theme === "anime" && "border-primary/30 text-primary hover:bg-primary/10"
              )}
            >
              <ImagePlus className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && !imageFile)}
              className={cn(
                theme === "cutesy" && "bg-primary hover:bg-primary/90",
                theme === "anime" && "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              )}
            >
              {loading ? (
                "Posting..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CreatePost;
