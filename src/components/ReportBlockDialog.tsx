import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Flag, Ban, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { containsProfanity } from "@/lib/profanity";

interface ReportBlockDialogProps {
  targetUserId: string;
  targetUserName: string;
  onBlock?: () => void;
  onReport?: () => void;
}

const REPORT_REASONS = [
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment" },
  { value: "fake", label: "Fake profile" },
  { value: "other", label: "Other" },
];

const ReportBlockDialog = ({ targetUserId, targetUserName, onBlock, onReport }: ReportBlockDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "report" | "block">("menu");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReport = async () => {
    if (!user || !reason) return;
    if (containsProfanity(description)) {
      toast({ title: "Inappropriate content", description: "Your report description contains inappropriate language.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("user_reports").insert({ reporter_id: user.id, reported_user_id: targetUserId, reason, description: description.trim() || null });
      if (error) throw error;
      toast({ title: "Report submitted", description: "Thank you for helping keep our community safe." });
      setOpen(false); resetForm(); onReport?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const handleBlock = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("blocked_users").insert({ user_id: user.id, blocked_user_id: targetUserId });
      if (error) throw error;
      toast({ title: "User blocked", description: `You will no longer see ${targetUserName}.` });
      setOpen(false); resetForm(); onBlock?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const resetForm = () => { setMode("menu"); setReason(""); setDescription(""); };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10 rounded-full bg-black/30 hover:bg-primary/50 text-white" onClick={(e) => e.stopPropagation()}>
          <Flag className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {mode === "menu" && "Report or Block"}
            {mode === "report" && "Report User"}
            {mode === "block" && "Block User"}
          </DialogTitle>
          <DialogDescription>
            {mode === "menu" && "What would you like to do?"}
            {mode === "report" && "Help us understand what happened."}
            {mode === "block" && `Are you sure you want to block ${targetUserName}?`}
          </DialogDescription>
        </DialogHeader>

        {mode === "menu" && (
          <div className="space-y-3 pt-4">
            <Button variant="outline" className="w-full justify-start gap-3" onClick={() => setMode("report")}>
              <Flag className="w-4 h-4" />Report {targetUserName}
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setMode("block")}>
              <Ban className="w-4 h-4" />Block {targetUserName}
            </Button>
          </div>
        )}

        {mode === "report" && (
          <div className="space-y-4 pt-4">
            <div className="space-y-3">
              <Label>Reason for reporting</Label>
              <RadioGroup value={reason} onValueChange={setReason}>
                {REPORT_REASONS.map((r) => (
                  <div key={r.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={r.value} id={r.value} />
                    <Label htmlFor={r.value} className="font-normal cursor-pointer">{r.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Additional details (optional)</Label>
              <Textarea placeholder="Describe what happened..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setMode("menu")} className="flex-1">Back</Button>
              <Button onClick={handleReport} disabled={!reason || submitting} className="flex-1">
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        )}

        {mode === "block" && (
          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-destructive" />
              <div>
                <p className="text-sm font-medium">This action cannot be undone easily</p>
                <p className="text-sm mt-1 text-muted-foreground">You won't see this user in your matches or feed.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setMode("menu")} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={handleBlock} disabled={submitting} className="flex-1">
                {submitting ? "Blocking..." : "Block User"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReportBlockDialog;
