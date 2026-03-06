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
import { containsProfanity } from "@/lib/profanity";
import { uploadAndModerate } from "@/lib/moderateImage";
import { validateRealLocation } from "@/lib/validateLocation";

interface CreatePostProps {
  onPostCreated: () => void;
}

const CreatePost = ({ onPostCreated }: CreatePostProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 10 - imageFiles.length;
    const toAdd = files.slice(0, remaining);

    setImageFiles(prev => [...prev, ...toAdd]);

    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && imageFiles.length === 0) return;
    if (!user) return;

    if (containsProfanity(content)) {
      toast({ title: "Inappropriate content", description: "Your post contains inappropriate language. Please revise it.", variant: "destructive" });
      return;
    }
    if (locationTag && containsProfanity(locationTag)) {
      toast({ title: "Inappropriate content", description: "Your location tag contains inappropriate language.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // Validate location is a real place
      if (locationTag.trim()) {
        const locationResult = await validateRealLocation(locationTag.trim());
        if (!locationResult.valid) {
          toast({ title: "Invalid location", description: "Please enter a real location.", variant: "destructive" });
          setLoading(false);
          return;
        }
        if (locationResult.formattedAddress) {
          setLocationTag(locationResult.formattedAddress);
        }
      }
      const uploadedUrls: string[] = [];

      for (const file of imageFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { publicUrl } = await uploadAndModerate("post-images", fileName, file);
        uploadedUrls.push(publicUrl);
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: content.trim(),
        image_url: uploadedUrls[0] || null,
        image_urls: uploadedUrls.length > 0 ? uploadedUrls : [],
        location_tag: locationTag.trim() || null,
        category: selectedCategories.length > 0 ? selectedCategories.join(",") : null,
      });

      if (error) throw error;

      setContent("");
      setLocationTag("");
      setSelectedCategories([]);
      setShowCategoryPicker(false);
      setImageFiles([]);
      setImagePreviews([]);
      onPostCreated();

      toast({ title: "Posted!", description: "Your travel experience has been shared." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-20 h-20 rounded-lg object-cover border-2 border-border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                    onClick={() => removeImage(index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Selected category flairs */}
          {selectedCategories.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCategories.map((cat) => (
                <span key={cat} className="flex items-center gap-1">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold",
                    allCategoryFlairs.find(f => f.label === cat)?.color || "bg-muted text-muted-foreground"
                  )}>
                    {cat}
                  </span>
                  <button onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {showCategoryPicker && (
            <div className="flex flex-wrap gap-1.5">
              {allCategoryFlairs.filter(f => !selectedCategories.includes(f.label)).map((flair) => (
                <button
                  key={flair.label}
                  onClick={() => {
                    setSelectedCategories(prev => [...prev, flair.label]);
                  }}
                  className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-all", flair.color)}
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
              multiple
              className="hidden"
            />

            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageFiles.length >= 10}
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
                selectedCategories.length > 0 && "bg-secondary"
              )}
            >
              <Tag className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && imageFiles.length === 0)}
              className="bg-primary hover:bg-primary/90 rounded-full px-6"
            >
              {loading ? "Posting..." : <><Send className="w-4 h-4 mr-2" />Post</>}
            </Button>
          </div>

          {imageFiles.length > 0 && (
            <p className="text-xs text-muted-foreground">{imageFiles.length}/10 images</p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default CreatePost;