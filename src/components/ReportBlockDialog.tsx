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
import { Flag, Ban, AlertTriangle, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { containsProfanity } from "@/lib/profanity";
import { submitReport, type MessageItem, type ReportResult } from "@/lib/moderationClient";

interface ReportBlockDialogProps {
  targetUserId: string;
  targetUserName: string;
  /** Pass conversation messages when reporting from chat — enables AI analysis */
  messages?: MessageItem[];
  conversationId?: string;
  /** "overlay" = absolute-positioned flag icon (default, for cards/profiles)
      "header"  = plain ghost button suitable for a chat header */
  variant?: "overlay" | "header";
  onBlock?: () => void;
  onReport?: () => void;
}

const REPORT_REASONS = [
  { value: "sexual_harassment", label: "Sexual harassment or explicit content" },
  { value: "vulgar_language",   label: "Vulgar or threatening language" },
  { value: "harassment",        label: "Harassment or bullying" },
  { value: "spam",              label: "Spam or scam" },
  { value: "fake",              label: "Fake profile" },
  { value: "other",             label: "Other" },
];

type Mode = "menu" | "report" | "block" | "result";

const ReportBlockDialog = ({
  targetUserId,
  targetUserName,
  messages = [],
  conversationId,
  variant = "overlay",
  onBlock,
  onReport,
}: ReportBlockDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  const resetForm = () => {
    setMode("menu");
    setReason("");
    setDescription("");
    setResult(null);
  };

  const handleReport = async () => {
    if (!user || !reason) return;

    if (containsProfanity(description)) {
      toast({
        title: "Inappropriate content",
        description: "Your report description contains inappropriate language.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitReport({
        reported_user_id: targetUserId,
        conversation_id: conversationId,
        messages,
        reason,
        description: description.trim() || undefined,
      });

      setResult(res);
      setMode("result");
      onReport?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("blocked_users")
        .insert({ user_id: user.id, blocked_user_id: targetUserId });
      if (error) throw error;
      toast({ title: "User blocked", description: `You will no longer see ${targetUserName}.` });
      setOpen(false);
      resetForm();
      onBlock?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const trigger =
    variant === "header" ? (
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        onClick={(e) => e.stopPropagation()}
      >
        <Flag className="w-4 h-4" />
      </Button>
    ) : (
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 rounded-full bg-black/30 hover:bg-primary/50 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <Flag className="w-4 h-4" />
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="border-border" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {mode === "menu"   && "Report or Block"}
            {mode === "report" && "Report User"}
            {mode === "block"  && "Block User"}
            {mode === "result" && (result?.action_taken ? "Account Suspended" : "Report Submitted")}
          </DialogTitle>
          <DialogDescription>
            {mode === "menu"   && "What would you like to do?"}
            {mode === "report" && "Help us understand what happened."}
            {mode === "block"  && `Are you sure you want to block ${targetUserName}?`}
            {mode === "result" && ""}
          </DialogDescription>
        </DialogHeader>

        {/* ── Menu ── */}
        {mode === "menu" && (
          <div className="space-y-3 pt-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => setMode("report")}
            >
              <Flag className="w-4 h-4" />
              Report {targetUserName}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setMode("block")}
            >
              <Ban className="w-4 h-4" />
              Block {targetUserName}
            </Button>
          </div>
        )}

        {/* ── Report form ── */}
        {mode === "report" && (
          <div className="space-y-4 pt-4">
            <div className="space-y-3">
              <Label>Reason for reporting</Label>
              <RadioGroup value={reason} onValueChange={setReason}>
                {REPORT_REASONS.map((r) => (
                  <div key={r.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={r.value} id={r.value} />
                    <Label htmlFor={r.value} className="font-normal cursor-pointer">
                      {r.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Additional details (optional)</Label>
              <Textarea
                placeholder="Describe what happened..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {messages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {messages.length} message{messages.length !== 1 ? "s" : ""} from this conversation will be analysed by AI.
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setMode("menu")} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleReport}
                disabled={!reason || submitting}
                className="flex-1"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analysing...
                  </span>
                ) : (
                  "Submit Report"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Block confirm ── */}
        {mode === "block" && (
          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-destructive" />
              <div>
                <p className="text-sm font-medium">This action cannot be undone easily</p>
                <p className="text-sm mt-1 text-muted-foreground">
                  You won't see this user in your matches or feed.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setMode("menu")} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleBlock}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? "Blocking..." : "Block User"}
              </Button>
            </div>
          </div>
        )}

        {/* ── AI result screen ── */}
        {mode === "result" && result && (
          <div className="space-y-4 pt-4 text-center">
            {result.action_taken ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Account Suspended</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Our AI confirmed a violation and has suspended this account immediately.
                  </p>
                </div>
                {result.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {result.categories.map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive border border-destructive/20 capitalize"
                      >
                        {c.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Report Submitted</p>
                  <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Thank you for helping keep Travela safe.
            </p>
            <Button className="w-full" onClick={() => { setOpen(false); resetForm(); }}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReportBlockDialog;
