import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Calendar, MapPin, Users, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

const MeetupDetail = () => {
  const { circleId, meetupId } = useParams<{ circleId: string; meetupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Fetch meetup post
  const { data: meetup, isLoading } = useQuery({
    queryKey: ["meetup", meetupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("circle_posts").select("*").eq("id", meetupId!).single();
      if (error) throw error;
      const { data: profile } = await supabase.from("profiles").select("user_id, display_name, avatar_url").eq("user_id", data.author_id).maybeSingle();
      return { ...data, author: profile };
    },
    enabled: !!meetupId,
  });

  const isHost = meetup?.author_id === user?.id;

  // Fetch requests
  const { data: requests } = useQuery({
    queryKey: ["meetup-requests", meetupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("circle_meetup_requests").select("*").eq("post_id", meetupId!).order("created_at");
      if (error) throw error;
      const userIds = data.map((r: any) => r.user_id);
      if (!userIds.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      const pMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      return data.map((r: any) => ({ ...r, profile: pMap[r.user_id] }));
    },
    enabled: !!meetupId,
  });

  const myRequest = requests?.find((r: any) => r.user_id === user?.id);
  const approvedCount = requests?.filter((r: any) => r.status === "approved").length || 0;
  const isFull = meetup?.max_people ? approvedCount >= meetup.max_people : false;

  // Request to join
  const requestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("circle_meetup_requests").insert({ post_id: meetupId!, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request sent!" });
      qc.invalidateQueries({ queryKey: ["meetup-requests", meetupId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Approve / Decline
  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      const { error } = await supabase.from("circle_meetup_requests").update({ status }).eq("id", requestId);
      if (error) throw error;

      // If approved, create a conversation between host and joiner
      if (status === "approved" && meetup) {
        const req = requests?.find((r: any) => r.id === requestId);
        if (req) {
          await supabase.from("conversations").insert({
            participant1_id: meetup.author_id < req.user_id ? meetup.author_id : req.user_id,
            participant2_id: meetup.author_id < req.user_id ? req.user_id : meetup.author_id,
            accepted: true,
          }).select().maybeSingle(); // ignore conflict
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["meetup-requests", meetupId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <AppLayout><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-20 rounded-xl mt-4" /></AppLayout>;
  }

  if (!meetup) {
    return <AppLayout><p className="text-center py-16 text-muted-foreground">Meetup not found.</p></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Meetup Info */}
        <Card className="border-2 border-purple-200">
          <CardContent className="p-5 space-y-4">
            <Badge className="bg-purple-100 text-purple-700">Meetup</Badge>
            <h1 className="text-xl font-bold">{meetup.text}</h1>

            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={meetup.author?.avatar_url} />
                <AvatarFallback>{meetup.author?.display_name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">Hosted by {meetup.author?.display_name || "Unknown"}</p>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground">
              {meetup.date_time && (
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4" />{format(new Date(meetup.date_time), "PPPP 'at' p")}</p>
              )}
              {meetup.location && (
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4" />{meetup.location}</p>
              )}
              {meetup.max_people && (
                <p className="flex items-center gap-2"><Users className="w-4 h-4" />{approvedCount}/{meetup.max_people} spots filled</p>
              )}
            </div>

            {/* Action button */}
            {!isHost && !myRequest && (
              <Button onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending || isFull} className="w-full gap-2">
                {isFull ? "Full" : "Request to Join"}
              </Button>
            )}
            {myRequest && (
              <Badge variant="secondary" className="capitalize">{myRequest.status === "pending" ? "⏳ Pending" : myRequest.status === "approved" ? "✅ Approved" : "❌ Declined"}</Badge>
            )}
          </CardContent>
        </Card>

        {/* Requests (host view) */}
        {isHost && requests && requests.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-bold text-base">Join Requests</h2>
            {requests.map((r: any) => (
              <Card key={r.id} className="border border-border/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="w-8 h-8 cursor-pointer" onClick={() => navigate(`/user/${r.user_id}`)}>
                    <AvatarImage src={r.profile?.avatar_url} />
                    <AvatarFallback>{r.profile?.display_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1">{r.profile?.display_name || "User"}</span>
                  {r.status === "pending" ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="text-green-600 h-8 w-8" onClick={() => updateRequestMutation.mutate({ requestId: r.id, status: "approved" })}>
                        <CheckCircle className="w-5 h-5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => updateRequestMutation.mutate({ requestId: r.id, status: "declined" })}>
                        <XCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="capitalize text-[10px]">{r.status}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Approved attendees */}
        {requests && requests.filter((r: any) => r.status === "approved").length > 0 && (
          <div className="space-y-2">
            <h2 className="font-bold text-base">Attendees</h2>
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

export default MeetupDetail;
