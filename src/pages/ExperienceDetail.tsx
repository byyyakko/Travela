import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiGet, apiPost, apiPatch } from "@/lib/dataClient";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users, Clock, Shield, Globe, CheckCircle, XCircle, Package, Share2 } from "lucide-react";
import { format } from "date-fns";
import { computeBookerPrice } from "@/lib/pricing";
import { Sparkles } from "lucide-react";

const ExperienceDetail = () => {
  const { experienceId } = useParams<{ experienceId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [joinMessage, setJoinMessage] = useState("");
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Fetch experience
  const { data: experience, isLoading } = useQuery({
    queryKey: ["experience", experienceId],
    queryFn: async () => {
      const data = await apiGet<any>(`/experiences/${experienceId}`);
      return {
        ...data,
        host: {
          user_id: data.host_id,
          display_name: data.host_display_name,
          avatar_url: data.host_avatar_url,
          bio: data.host_bio,
          languages: data.host_languages,
          subscription_tier: data.host_subscription_tier,
        },
      };
    },
    enabled: !!experienceId,
  });

  const { data: viewerProfile } = useQuery({
    queryKey: ["viewerSubscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("subscription_tier").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isHost = experience?.host_id === user?.id;

  // Fetch my request (traveller checking their own status — kept on Supabase as the
  // backend /requests endpoint is host-only)
  const { data: myRequest } = useQuery({
    queryKey: ["experience-my-request", experienceId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("experience_join_requests")
        .select("*")
        .eq("experience_id", experienceId!)
        .eq("traveller_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!experienceId && !!user && !isHost,
  });

  // Fetch all requests (host-only view via backend)
  const { data: requests } = useQuery({
    queryKey: ["experience-requests", experienceId],
    queryFn: async () => {
      try {
        const data = await apiGet<any[]>(`/experiences/${experienceId}/requests`);
        // Reshape requester profile fields to match existing JSX expectations
        return data.map((r: any) => ({
          ...r,
          profile: {
            display_name: r.requester_display_name,
            avatar_url: r.requester_avatar_url,
          },
        }));
      } catch {
        // Non-hosts will receive a 403 — return empty so approved count is shown as 0
        return [];
      }
    },
    enabled: !!experienceId,
  });

  const approvedCount = requests?.filter((r: any) => r.status === "approved").length || 0;
  const spotsLeft = experience?.max_people ? experience.max_people - approvedCount : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;

  const bookerPrice = experience
    ? computeBookerPrice({
        price: experience.price,
        hostTier: (experience.host as any)?.subscription_tier,
        viewerTier: viewerProfile?.subscription_tier,
        schedule: experience.schedule,
        spotsLeft,
      })
    : null;

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/experiences/${experienceId}`;
    const shareText = `Check out "${experience?.title}" on Travela! 🌍`;

    if (navigator.share) {
      try {
        await navigator.share({ title: experience?.title, text: shareText, url: shareUrl });
      } catch {
        // User cancelled — do nothing
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied!", description: "Paste it on Instagram or anywhere else." });
    }
  };

  // Submit join request
  const joinMutation = useMutation({
    mutationFn: async () => {
      await apiPost(`/experiences/${experienceId}/join`, {
        message: joinMessage.trim() || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Request sent!", description: "The host will review your request." });
      setShowJoinForm(false);
      setJoinMessage("");
      qc.invalidateQueries({ queryKey: ["experience-my-request", experienceId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Host: approve/decline
  const updateMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      await apiPatch(`/experiences/${experienceId}/requests/${requestId}`, { status });
      // Auto-create conversation on approval (kept on Supabase per migration plan)
      if (status === "approved" && experience) {
        const req = requests?.find((r: any) => r.id === requestId);
        if (req) {
          const p1 = experience.host_id < req.traveller_id ? experience.host_id : req.traveller_id;
          const p2 = experience.host_id < req.traveller_id ? req.traveller_id : experience.host_id;
          await supabase.from("conversations").insert({
            participant1_id: p1,
            participant2_id: p2,
            accepted: true,
          }).select().maybeSingle();
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["experience-requests", experienceId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <AppLayout><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-60 rounded-xl mt-4" /></AppLayout>;
  }
  if (!experience) {
    return <AppLayout><p className="text-center py-16 text-muted-foreground">Experience not found.</p></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Main info */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-bold">{experience.title}</h1>
            <button
              onClick={handleShare}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-secondary border-2 border-primary/30 flex items-center justify-center hover:bg-secondary/80 transition-colors"
              aria-label="Share experience"
            >
              <Share2 className="w-4 h-4 text-primary" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate(`/user/${experience.host_id}`)}>
              <AvatarImage src={experience.host?.avatar_url} />
              <AvatarFallback>{experience.host?.display_name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">Hosted by {experience.host?.display_name || "Someone"}</p>
              {experience.host?.languages?.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {experience.host.languages.join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Tags */}
          {experience.tags?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {experience.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="capitalize text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Price */}
          {bookerPrice && (
            <div className="flex items-center gap-2 flex-wrap">
              {bookerPrice.total === 0 ? (
                <Badge className="bg-green-100 text-green-700 text-sm">Free</Badge>
              ) : (
                <Badge variant="outline" className="text-sm">{bookerPrice.display}</Badge>
              )}
              {bookerPrice.isLastMinuteDeal && bookerPrice.originalDisplay && (
                <>
                  <span className="text-xs text-muted-foreground line-through">{bookerPrice.originalDisplay}</span>
                  <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                    <Sparkles className="w-3 h-3" /> 50% off · Plus deal
                  </Badge>
                </>
              )}
            </div>
          )}
        </div>

        {/* Details grid */}
        <Card>
          <CardContent className="p-4 grid gap-3 text-sm">
            {experience.schedule && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>{format(new Date(experience.schedule), "PPPP 'at' p")}</span>
              </div>
            )}
            {experience.duration && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{experience.duration}</span>
              </div>
            )}
            {experience.meeting_point && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{experience.meeting_point}</span>
              </div>
            )}
            {experience.max_people && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4 shrink-0" />
                <span>{approvedCount}/{experience.max_people} joined{spotsLeft !== null && spotsLeft > 0 && ` · ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}</span>
              </div>
            )}
            {experience.language && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="w-4 h-4 shrink-0" />
                <span>{experience.language}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        {experience.description && (
          <div>
            <h2 className="font-bold text-base mb-2">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{experience.description}</p>
          </div>
        )}

        {/* Itinerary */}
        {experience.itinerary?.length > 0 && (
          <div>
            <h2 className="font-bold text-base mb-2">Itinerary</h2>
            <ul className="space-y-1.5">
              {experience.itinerary.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What to bring */}
        {experience.what_to_bring && (
          <div>
            <h2 className="font-bold text-base mb-2 flex items-center gap-1"><Package className="w-4 h-4" /> What to Bring</h2>
            <p className="text-sm text-muted-foreground">{experience.what_to_bring}</p>
          </div>
        )}

        {/* Safety */}
        {experience.safety_guidelines && (
          <div>
            <h2 className="font-bold text-base mb-2 flex items-center gap-1"><Shield className="w-4 h-4" /> Safety</h2>
            <p className="text-sm text-muted-foreground">{experience.safety_guidelines}</p>
          </div>
        )}

        {/* Join action */}
        {!isHost && !myRequest && !showJoinForm && (
          <Button onClick={() => setShowJoinForm(true)} disabled={isFull} className="w-full">
            {isFull ? "Full — No Spots Left" : "Request to Join"}
          </Button>
        )}

        {showJoinForm && (
          <Card className="border-2 border-primary/30">
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Share what you're hoping to experience and any preferences.</Label>
              <Textarea
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                placeholder="e.g. I love trying local street food and I'm vegetarian..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} className="flex-1">
                  {joinMutation.isPending ? "Sending..." : "Send Request"}
                </Button>
                <Button variant="ghost" onClick={() => setShowJoinForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {myRequest && (
          <Card className="border border-border/60">
            <CardContent className="p-4">
              <p className="text-sm font-medium">
                {myRequest.status === "pending" && "⏳ Your request is pending..."}
                {myRequest.status === "approved" && "✅ You're in! Check your messages for the group chat."}
                {myRequest.status === "declined" && "❌ Your request was declined."}
              </p>
              {myRequest.message && <p className="text-xs text-muted-foreground mt-1">Your message: "{myRequest.message}"</p>}
            </CardContent>
          </Card>
        )}

        {/* Host: manage requests */}
        {isHost && requests && requests.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-base">Join Requests ({requests.filter((r: any) => r.status === "pending").length} pending)</h2>
            {requests.map((r: any) => (
              <Card key={r.id} className="border border-border/60">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 cursor-pointer" onClick={() => navigate(`/user/${r.traveller_id}`)}>
                      <AvatarImage src={r.profile?.avatar_url} />
                      <AvatarFallback>{r.profile?.display_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1">{r.profile?.display_name || "Traveller"}</span>
                    {r.status === "pending" ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="text-green-600 h-8 w-8" onClick={() => updateMutation.mutate({ requestId: r.id, status: "approved" })}>
                          <CheckCircle className="w-5 h-5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => updateMutation.mutate({ requestId: r.id, status: "declined" })}>
                          <XCircle className="w-5 h-5" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="capitalize text-[10px]">{r.status}</Badge>
                    )}
                  </div>
                  {r.message && <p className="text-xs text-muted-foreground italic">"{r.message}"</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Approved attendees */}
        {requests && requests.filter((r: any) => r.status === "approved").length > 0 && (
          <div className="space-y-2">
            <h2 className="font-bold text-base">Going</h2>
            <div className="flex flex-wrap gap-2">
              {requests.filter((r: any) => r.status === "approved").map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 bg-secondary rounded-full px-3 py-1.5">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={r.profile?.avatar_url} />
                    <AvatarFallback className="text-[10px]">{r.profile?.display_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{r.profile?.display_name || "User"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ExperienceDetail;
