import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAndModerate } from "@/lib/moderateImage";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const PRESET_AVATARS = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Traveler1&backgroundColor=b6e3f4",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Traveler2&backgroundColor=ffdfbf",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Explorer1&backgroundColor=c0aede",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Explorer2&backgroundColor=d1d4f9",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Wanderer1&backgroundColor=ffd5dc",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Wanderer2&backgroundColor=b6f4b6",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Nomad1&backgroundColor=f4e3b6",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Nomad2&backgroundColor=b6f4e3",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Happy1&backgroundColor=b6e3f4",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Cool1&backgroundColor=ffdfbf",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Chill1&backgroundColor=c0aede",
  "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Fun1&backgroundColor=ffd5dc",
];

interface AvatarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar: string | null;
  onAvatarChange: (url: string) => void;
}

const AvatarPickerDialog = ({ open, onOpenChange, currentAvatar, onAvatarChange }: AvatarPickerDialogProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handleSelectPreset = async (url: string) => {
    if (!user) return;
    setSelectedPreset(url);
    try {
      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      onAvatarChange(url);
      toast({ title: "Avatar updated!" });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error updating avatar", description: error.message, variant: "destructive" });
    } finally {
      setSelectedPreset(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      const { publicUrl } = await uploadAndModerate("avatars", fileName, file, { upsert: true });
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      onAvatarChange(publicUrl);
      toast({ title: "Profile picture updated!" });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error uploading photo", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Choose Your Avatar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload own photo */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload Your Own Photo"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or pick a preset</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Preset grid */}
          <div className="grid grid-cols-4 gap-3">
            {PRESET_AVATARS.map((url) => {
              const isSelected = currentAvatar === url;
              return (
                <button
                  key={url}
                  onClick={() => handleSelectPreset(url)}
                  disabled={selectedPreset !== null}
                  className={cn(
                    "relative rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary",
                    isSelected && "ring-2 ring-primary"
                  )}
                >
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={url} alt="Preset avatar" />
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                  {isSelected && (
                    <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarPickerDialog;
