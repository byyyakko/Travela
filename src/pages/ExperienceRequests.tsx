import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

const ExperienceRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Get all experiences hosted by user
  const { data: myExperiences, isLoading } = useQuery({
    queryKey: ["my-hosted-experiences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("experiences")
        .select("id, title")
        .eq("host_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get all requests for those experiences
  const { data: allRequests } = useQuery({
    queryKey: ["my-hosted-requests", myExperiences?.map((e: any) => e.id)],
    queryFn: async () => {
      if (!myExperiences?.length) return [];
      const ids = myExperiences.map((e: any) => e.id);
      const { data, error } = await supabase
        .from("experience_join_requests")
        .select("*")
        .in("experience_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set(data.map((r: any) => r.traveller_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      const pMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      const expMap = Object.fromEntries(myExperiences.map((e: any) => [e.id, e]));
      return data.map((r: any) => ({ ...r, profile: pMap[r.traveller_id], experience: expMap[r.experience_id] }));
    },
    enabled: !!myExperiences,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ requestId, status, travellerId, hostId }: { requestId: string; status: string; travellerId: string; hostId: string }) => {
      const { error } = await supabase.from("experience_join_requests").update({ status }).eq("id", requestId);
      if (error) throw error;
      if (status === "approved") {
        const p1 = hostId < travellerId ? hostId : travellerId;
        const p2 = hostId < travellerId ? travellerId : hostId;
        await supabase.from("conversations").insert({ participant1_id: p1, participant2_id: p2, accepted: true }).select().maybeSingle();
      }
    },
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["my-hosted-requests"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/experiences")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">My Experience Requests</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : !allRequests?.length ? (
          <p className="text-center py-16 text-muted-foreground text-sm">No requests yet.</p>
        ) : (
          <div className="space-y-3">
            {allRequests.map((r: any) => (
              <Card key={r.id} className="border border-border/60">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">For: <span className="font-medium text-foreground">{r.experience?.title}</span></p>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 cursor-pointer" onClick={() => navigate(`/user/${r.traveller_id}`)}>
                      <AvatarImage src={r.profile?.avatar_url} />
                      <AvatarFallback>{r.profile?.display_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1">{r.profile?.display_name || "Traveller"}</span>
                    {r.status === "pending" ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="text-green-600 h-8 w-8" onClick={() => updateMutation.mutate({ requestId: r.id, status: "approved", travellerId: r.traveller_id, hostId: user!.id })}>
                          <CheckCircle className="w-5 h-5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => updateMutation.mutate({ requestId: r.id, status: "declined", travellerId: r.traveller_id, hostId: user!.id })}>
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
      </div>
    </AppLayout>
  );
};

export default ExperienceRequests;
