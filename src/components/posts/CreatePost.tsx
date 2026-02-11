import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImagePlus, MapPin, X, Send, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { allCategoryFlairs } from "@/components/home/CutesyHome";

interface CreatePostProps {
  onPostCreated: () => void;
}

const CreatePost = ({ onPostCreated }: CreatePostProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
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
        category: selectedCategory,
      });

      if (error) throw error;

      setContent("");
      setLocationTag("");
      setSelectedCategory(null);
      setShowCategoryPicker(false);
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
    <Card className="p-4 cutesy-border bg-card/95">
      <div className="flex gap-3">
        <Avatar className="w-10 h-10 ring-[3px] ring-primary">
          <AvatarImage src="" />
          <AvatarFallback className="bg-secondary text-primary font-bold">
            {user?.email?.[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-3">
          <Textarea
            placeholder="Share your travel experience... ✨"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[80px] resize-none bg-background border-2 border-primary/40 focus:border-primary rounded-2xl"
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

          {/* Category flair picker */}
          {selectedCategory && (
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold",
                allCategoryFlairs.find(f => f.label === selectedCategory)?.color || "bg-muted text-muted-foreground"
              )}>
                {selectedCategory}
              </span>
              <button onClick={() => setSelectedCategory(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {showCategoryPicker && (
            <div className="flex flex-wrap gap-1.5">
              {allCategoryFlairs.map((flair) => (
                <button
                  key={flair.label}
                  onClick={() => {
                    setSelectedCategory(flair.label);
                    setShowCategoryPicker(false);
                  }}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                    flair.color
                  )}
                >
                  {flair.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Add location..."
                value={locationTag}
                onChange={(e) => setLocationTag(e.target.value)}
                className="pl-9 bg-background border-2 border-primary/40 rounded-full"
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
              className="border-2 border-primary/40 text-primary hover:bg-secondary rounded-full"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className={cn(
                "border-2 border-primary/40 text-primary hover:bg-secondary rounded-full",
                selectedCategory && "bg-secondary"
              )}
            >
              <Tag className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && !imageFile)}
              className="bg-primary hover:bg-primary/90 rounded-full px-6"
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
