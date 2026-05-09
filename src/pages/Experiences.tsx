import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, MapPin, Calendar as CalIcon, Users, Clock, Filter, X, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { scoreExperiences, type UserPreferences } from "@/lib/recommendations";
import { computeBookerPrice, isPremiumTier } from "@/lib/pricing";

const TAG_CHIPS = ["Food", "Culture", "Outdoors", "Night", "Arts", "Tech", "Study", "Volunteering", "Photo", "Music"];

const TIME_FILTERS = [
  { label: "Morning", value: "morning" },
  { label: "Afternoon", value: "afternoon" },
  { label: "Evening", value: "evening" },
  { label: "Night", value: "night" },
];

const Experiences = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [timeFilter, setTimeFilter] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // User profile for recommendations
  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
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

  const { data: experiences, isLoading } = useQuery({
    queryKey: ["experiences", search, activeTag, dateFilter?.toISOString(), timeFilter, freeOnly],
    queryFn: async () => {
      let q = supabase.from("experiences").select("*").order("schedule", { ascending: true });

      if (search.trim()) {
        q = q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
      }
      if (activeTag) q = q.contains("tags", [activeTag.toLowerCase()]);
      if (freeOnly) q = q.or("price.is.null,price.eq.");

      const { data, error } = await q;
      if (error) throw error;

      // Fetch host profiles
      const hostIds = [...new Set(data.map((e: any) => e.host_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, subscription_tier")
        .in("user_id", hostIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));

      // Fetch approved counts
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

      let result = data.map((e: any) => ({
        ...e,
        host: profileMap[e.host_id],
        approved_count: approvedCounts[e.id] || 0,
      }));

      // Client-side date filter
      if (dateFilter) {
        result = result.filter((e: any) => e.schedule && isSameDay(new Date(e.schedule), dateFilter));
      }

      // Client-side time filter
      if (timeFilter) {
        result = result.filter((e: any) => {
          if (!e.schedule) return false;
          const h = new Date(e.schedule).getHours();
          if (timeFilter === "morning") return h >= 6 && h < 12;
          if (timeFilter === "afternoon") return h >= 12 && h < 17;
          if (timeFilter === "evening") return h >= 17 && h < 21;
          if (timeFilter === "night") return h >= 21 || h < 6;
          return true;
        });
      }

      return result;
    },
  });

  const hasActiveFilters = !!dateFilter || !!timeFilter || freeOnly;
  const hasFiltersOrSearch = hasActiveFilters || !!search.trim() || !!activeTag;

  const suggestedExperiences = useMemo(() => {
    if (!prefs || !experiences || hasFiltersOrSearch) return [];
    return scoreExperiences(prefs, experiences).slice(0, 3);
  }, [prefs, experiences, hasFiltersOrSearch]);

  const viewerTier = (userProfile as any)?.subscription_tier;
  const viewerIsPremium = isPremiumTier(viewerTier);

  const lastMinuteDeals = useMemo(() => {
    if (!viewerIsPremium || !experiences || hasFiltersOrSearch) return [];
    return experiences
      .map((e: any) => {
        const spotsLeft = e.max_people ? e.max_people - e.approved_count : null;
        const bp = computeBookerPrice({
          price: e.price,
          hostTier: e.host?.subscription_tier,
          viewerTier,
          schedule: e.schedule,
          spotsLeft,
        });
        return { exp: e, bp, spotsLeft };
      })
      .filter((x) => x.bp.isLastMinuteDeal)
      .slice(0, 5);
  }, [experiences, viewerTier, viewerIsPremium, hasFiltersOrSearch]);
  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Experiences</h1>
          <Button size="sm" onClick={() => navigate("/experiences/create")} className="gap-1">
            <Plus className="w-4 h-4" /> Host
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder='Search "hawker", "photo walk", "hidden gems"...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-full"
          />
        </div>

        {/* Tag chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {TAG_CHIPS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all",
                activeTag === tag
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
              )}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Filters toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("gap-1", hasActiveFilters && "border-primary text-primary")}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 ml-1">
                {[dateFilter, timeFilter, freeOnly].filter(Boolean).length}
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFilter(undefined); setTimeFilter(null); setFreeOnly(false); }}
              className="text-xs text-muted-foreground gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 p-4 rounded-xl bg-secondary/50 border border-border"
          >
            {/* Date picker */}
            <div>
              <p className="text-xs font-semibold mb-1.5">Date</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <CalIcon className="w-3.5 h-3.5" />
                    {dateFilter ? format(dateFilter, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time of day */}
            <div>
              <p className="text-xs font-semibold mb-1.5">Time of Day</p>
              <div className="flex gap-1.5 flex-wrap">
                {TIME_FILTERS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTimeFilter(timeFilter === t.value ? null : t.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs border transition-all",
                      timeFilter === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Free/Paid */}
            <div>
              <button
                onClick={() => setFreeOnly(!freeOnly)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs border transition-all",
                  freeOnly
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                Free only
              </button>
            </div>
          </motion.div>
        )}

        {/* Suggested for you */}
        {suggestedExperiences.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-primary">
              <Sparkles className="w-4 h-4" /> Suggested for you
            </h2>
            <div className="grid gap-2">
              {suggestedExperiences.map(({ item: exp, reasons }) => (
                <Card
                  key={(exp as any).id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-primary/30 border"
                  onClick={() => navigate(`/experiences/${(exp as any).id}`)}
                >
                  <CardContent className="p-3 space-y-1">
                    <p className="text-[10px] text-primary font-medium">
                      💡 {reasons.slice(0, 2).join(" · ")}
                    </p>
                    <h3 className="font-bold text-sm">{(exp as any).title}</h3>
                    {(exp as any).schedule && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalIcon className="w-3 h-3" />
                        {format(new Date((exp as any).schedule), "MMM d, h:mm a")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Experience cards */}
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : !experiences?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <CalIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No experiences found</p>
            <p className="text-sm mt-1">Try different filters or host your own!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {experiences.map((exp: any, i: number) => {
              const spotsLeft = exp.max_people ? exp.max_people - exp.approved_count : null;
              return (
                <motion.div
                  key={exp.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow border border-border/60"
                    onClick={() => navigate(`/experiences/${exp.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-base leading-tight">{exp.title}</h3>
                          {exp.price && (
                            <Badge variant="secondary" className="shrink-0 text-xs">{exp.price}</Badge>
                          )}
                          {!exp.price && (
                            <Badge className="bg-green-100 text-green-700 shrink-0 text-xs">Free</Badge>
                          )}
                        </div>

                        {/* Tags */}
                        {exp.tags?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {exp.tags.slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{tag}</Badge>
                            ))}
                          </div>
                        )}

                        {/* Schedule & location */}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {exp.schedule && (
                            <span className="flex items-center gap-1">
                              <CalIcon className="w-3 h-3" />
                              {format(new Date(exp.schedule), "MMM d, h:mm a")}
                            </span>
                          )}
                          {exp.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{exp.city}
                            </span>
                          )}
                          {exp.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{exp.duration}
                            </span>
                          )}
                        </div>

                        {/* Host + spots */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={exp.host?.avatar_url} />
                              <AvatarFallback className="text-[10px]">{exp.host?.display_name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">{exp.host?.display_name?.split(" ")[0] || "Host"}</span>
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
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* My Hosted Experiences link */}
        <div className="pt-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/experiences/my-requests")} className="text-xs text-muted-foreground w-full">
            View my hosted requests →
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Experiences;
