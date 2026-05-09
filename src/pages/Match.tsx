import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, MapPin, Calendar as CalIcon, Clock, Users, Compass } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { scoreExperiences, type UserPreferences } from "@/lib/recommendations";
import { displayPrice } from "@/lib/pricing";

const Match = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const prefs: UserPreferences | null = userProfile
    ? {
        interests: userProfile.interests || [],
        location: userProfile.location,
        destination: userProfile.destination,
        languages: userProfile.languages || [],
        travel_start_date: userProfile.travel_start_date,
        travel_end_date: userProfile.travel_end_date,
        activity_vibe: (userProfile as any).activity_vibe || "both",
        time_availability: (userProfile as any).time_availability || [],
      }
    : null;

  const { data: experiences, isLoading: expLoading } = useQuery({
    queryKey: ["allExperiences"],
    queryFn: async () => {
      const { data } = await supabase
        .from("experiences")
        .select("*")
        .gte("schedule", new Date().toISOString())
        .order("schedule", { ascending: true })
        .limit(50);

      if (!data?.length) return [];

      const hostIds = [...new Set(data.map((e: any) => e.host_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", hostIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));

      const expIds = data.map((e: any) => e.id);
      let approvedCounts: Record<string, number> = {};
      if (expIds.length) {
        const { data: reqData } = await supabase
          .from("experience_join_requests")
          .select("experience_id")
          .in("experience_id", expIds)
          .eq("status", "approved");
        if (reqData) {
          reqData.forEach((r: any) => {
            approvedCounts[r.experience_id] = (approvedCounts[r.experience_id] || 0) + 1;
          });
        }
      }

      return data.map((e: any) => ({
        ...e,
        host: profileMap[e.host_id],
        approved_count: approvedCounts[e.id] || 0,
      }));
    },
    enabled: !!user,
  });

  const suggestedExperiences = prefs && experiences ? scoreExperiences(prefs, experiences).slice(0, 5) : [];

  const isLoading = expLoading || !userProfile;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            For You
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalised suggestions based on your interests, location & schedule
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* Suggested Experiences */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Suggested Experiences</h2>
              </div>
              {suggestedExperiences.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No suggestions yet — update your interests or travel dates in your profile.
                </p>
              ) : (
                <div className="grid gap-3">
                  {suggestedExperiences.map(({ item: exp, reasons }, i) => {
                    const spotsLeft = exp.max_people ? exp.max_people - ((exp as any).approved_count || 0) : null;
                    return (
                      <motion.div
                        key={(exp as any).id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card
                          className="cursor-pointer hover:shadow-md transition-shadow border border-border/60"
                          onClick={() => navigate(`/experiences/${(exp as any).id}`)}
                        >
                          <CardContent className="p-4 space-y-2">
                            <p className="text-[11px] text-primary font-medium bg-primary/10 rounded-full px-2.5 py-1 w-fit">
                              💡 Suggested because {reasons[0]?.toLowerCase()}
                              {reasons[1] ? ` and ${reasons[1].toLowerCase()}` : ""}
                            </p>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-bold text-base leading-tight">{(exp as any).title}</h3>
                              {(exp as any).price ? (
                                <Badge variant="secondary" className="shrink-0 text-xs">{displayPrice((exp as any).price)}</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-700 shrink-0 text-xs">Free</Badge>
                              )}
                            </div>
                            {(exp as any).tags?.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {(exp as any).tags.slice(0, 3).map((tag: string) => (
                                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{tag}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {(exp as any).schedule && (
                                <span className="flex items-center gap-1">
                                  <CalIcon className="w-3 h-3" />
                                  {format(new Date((exp as any).schedule), "MMM d, h:mm a")}
                                </span>
                              )}
                              {(exp as any).city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />{(exp as any).city}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={(exp as any).host?.avatar_url} />
                                  <AvatarFallback className="text-[10px]">{(exp as any).host?.display_name?.[0] || "?"}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">{(exp as any).host?.display_name?.split(" ")[0] || "Host"}</span>
                              </div>
                              {spotsLeft !== null && (
                                <span className={cn(
                                  "text-xs font-semibold",
                                  spotsLeft <= 0 ? "text-destructive" : spotsLeft <= 2 ? "text-orange-500" : "text-muted-foreground"
                                )}>
                                  {spotsLeft <= 0 ? "Full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>

          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Match;
