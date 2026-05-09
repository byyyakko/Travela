import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  MapPin,
  Globe,
  MessageSquare,
  Sparkles,
  Users,
  Languages,
  Send,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const INTEREST_CHIPS = [
  "Food", "Culture", "Outdoors", "Night", "Arts", "Tech", "History", "Music",
];

interface LocalProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  interests: string[] | null;
  languages: string[] | null;
  is_verified: boolean | null;
  gender: string | null;
}

const Match = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedLocal, setSelectedLocal] = useState<LocalProfile | null>(null);
  const [connectMessage, setConnectMessage] = useState("");

  // Current user profile (base fields from Supabase, gender from Neon)
  const { data: rawUserProfile } = useQuery({
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

  const { data: myNeonGender } = useQuery({
    queryKey: ["neonGender", user?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${backendUrl}/profiles/me/gender`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!resp.ok) return null;
      return resp.json() as Promise<{ gender: string | null; same_gender_only: boolean }>;
    },
    enabled: !!user,
  });

  const userProfile = rawUserProfile
    ? { ...rawUserProfile, gender: myNeonGender?.gender ?? null, same_gender_only: myNeonGender?.same_gender_only ?? false }
    : null;

  // Fetch local guides (display fields only — gender comes from Neon)
  const { data: rawLocals, isLoading } = useQuery({
    queryKey: ["localGuides", search, activeTag],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, bio, location, interests, languages, is_verified")
        .eq("is_local", true)
        .eq("is_restricted", false);

      if (user) q = q.neq("user_id", user.id);
      if (search.trim()) q = q.ilike("display_name", `%${search.trim()}%`);
      if (activeTag) q = q.contains("interests", [activeTag.toLowerCase()]);

      const { data, error } = await q.order("updated_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data || []).map(p => ({ ...p, gender: null as string | null })) as LocalProfile[];
    },
    enabled: !!user,
  });

  // Batch-fetch gender for all locals from Neon
  const localUserIds = rawLocals?.map(l => l.user_id) ?? [];
  const { data: localGenders } = useQuery({
    queryKey: ["localGenders", localUserIds.join(",")],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${backendUrl}/profiles/locals/gender`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ user_ids: localUserIds }),
      });
      if (!resp.ok) return [] as { user_id: string; gender: string | null }[];
      return resp.json() as Promise<{ user_id: string; gender: string | null }[]>;
    },
    enabled: localUserIds.length > 0,
  });

  // Merge Neon gender into locals
  const locals: LocalProfile[] | undefined = (() => {
    if (!rawLocals) return undefined;
    if (!localGenders) return rawLocals;
    const genderMap = Object.fromEntries(localGenders.map(g => [g.user_id, g.gender]));
    return rawLocals.map(l => ({ ...l, gender: genderMap[l.user_id] ?? null }));
  })();

  // Check existing conversations to know who we already connected with
  const { data: existingConvos } = useQuery({
    queryKey: ["myConversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("conversations")
        .select("participant1_id, participant2_id, accepted")
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);
      return data || [];
    },
    enabled: !!user,
  });

  const backendUrl = import.meta.env.VITE_BACKEND_URL?.trim() || "https://travela-backend-p2zp.onrender.com";
  const sameGenderOnly = !!(userProfile?.same_gender_only) &&
    !!userProfile?.gender && userProfile.gender !== "prefer_not_to_say";

  // ML-ranked suggestions from the backend /rank endpoint
  const { data: mlSuggestions } = useQuery({
    queryKey: ["mlRankedLocals", userProfile?.user_id, locals?.map(l => l.user_id).join(","), sameGenderOnly],
    queryFn: async () => {
      if (!userProfile || !locals || locals.length === 0) return [];
      const body = {
        user: {
          user_id: userProfile.user_id,
          interests: userProfile.interests || [],
          languages: userProfile.languages || [],
          location: userProfile.location || null,
          is_local: userProfile.is_local ?? false,
          gender: userProfile.gender || null,
        },
        candidates: locals.map((l) => ({
          user_id: l.user_id,
          interests: l.interests || [],
          languages: l.languages || [],
          location: l.location || null,
          is_local: true,
          gender: l.gender || null,
        })),
        same_gender_only: sameGenderOnly,
      };
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${backendUrl}/rank`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return [];
      const result = await resp.json();
      return (result.ranked as Array<{ user_id: string; match_score: number; matched_interests: string[] }>).slice(0, 5);
    },
    enabled: !!userProfile && !!locals && locals.length > 0,
  });

  // Map ranked results back to full LocalProfile objects for display
  const scoredLocals = (() => {
    if (!mlSuggestions || !locals) return [];
    const localMap = Object.fromEntries(locals.map(l => [l.user_id, l]));
    return mlSuggestions
      .filter(r => localMap[r.user_id])
      .map(r => ({
        local: localMap[r.user_id],
        reasons: r.matched_interests.length > 0
          ? [`You both chose: ${r.matched_interests.slice(0, 2).join(" + ")}`]
          : [],
      }));
  })();

  // Apply gender filter to the full locals grid when same_gender_only is set
  const _filterable = new Set(["male", "female", "non_binary"]);
  const visibleLocals = (() => {
    if (!locals) return [];
    if (!sameGenderOnly || !userProfile?.gender) return locals;
    const ug = userProfile.gender;
    return locals.filter(l => !l.gender || !_filterable.has(l.gender) || l.gender === ug);
  })();

  // Get conversation status with a local
  const getConvoStatus = (localId: string) => {
    if (!existingConvos) return null;
    return existingConvos.find(
      (c: any) =>
        (c.participant1_id === user?.id && c.participant2_id === localId) ||
        (c.participant2_id === user?.id && c.participant1_id === localId)
    );
  };

  // Request to connect mutation
  const connectMutation = useMutation({
    mutationFn: async ({ localId, message }: { localId: string; message: string }) => {
      if (!user) throw new Error("Not authenticated");
      const p1 = user.id < localId ? user.id : localId;
      const p2 = user.id < localId ? localId : user.id;

      // Create conversation
      const { data: convo, error: convoErr } = await supabase
        .from("conversations")
        .insert({ participant1_id: p1, participant2_id: p2 })
        .select()
        .single();
      if (convoErr) {
        if (convoErr.code === "23505") throw new Error("You already sent a request to this guide.");
        throw convoErr;
      }

      // Send intro message
      if (message.trim()) {
        await supabase.from("messages").insert({
          conversation_id: convo.id,
          sender_id: user.id,
          content: message.trim(),
        });
      }

      return convo;
    },
    onSuccess: () => {
      toast({ title: "Request sent!", description: "The local guide will review your request." });
      setSelectedLocal(null);
      setConnectMessage("");
      queryClient.invalidateQueries({ queryKey: ["myConversations"] });
    },
    onError: (err: any) => {
      toast({ title: "Could not connect", description: err.message, variant: "destructive" });
    },
  });

  const handleConnect = () => {
    if (!selectedLocal) return;
    connectMutation.mutate({ localId: selectedLocal.user_id, message: connectMessage });
  };

  const hasFilters = !!search.trim() || !!activeTag;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            Ask a Local
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with local guides for cultural exchange & travel tips
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search local guides..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-full"
          />
        </div>

        {/* Interest chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {INTEREST_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveTag(activeTag === chip ? null : chip)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all",
                activeTag === chip
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
              )}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Suggested locals */}
        {!hasFilters && scoredLocals.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-primary">
              <Sparkles className="w-4 h-4" /> Suggested for you
            </h2>
            <div className="grid gap-2">
              {scoredLocals.map(({ local, reasons }) => (
                <LocalCard
                  key={local.user_id}
                  local={local}
                  reasons={reasons}
                  convoStatus={getConvoStatus(local.user_id)}
                  onTap={() => setSelectedLocal(local)}
                  onMessage={() => navigate("/messages")}
                  isSuggested
                />
              ))}
            </div>
          </section>
        )}

        {/* All locals */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : !visibleLocals.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No local guides found</p>
            <p className="text-sm mt-1">Try a different search or check back later</p>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-bold text-muted-foreground">
              {hasFilters ? "Results" : "All Local Guides"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {visibleLocals.map((local, i) => (
                <motion.div
                  key={local.user_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <LocalCard
                    local={local}
                    convoStatus={getConvoStatus(local.user_id)}
                    onTap={() => setSelectedLocal(local)}
                    onMessage={() => navigate("/messages")}
                  />
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Local Profile Detail / Connect Dialog */}
      <Dialog open={!!selectedLocal} onOpenChange={(open) => !open && setSelectedLocal(null)}>
        <DialogContent className="max-w-md">
          {selectedLocal && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={selectedLocal.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {selectedLocal.display_name?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="flex items-center gap-1.5">
                      {selectedLocal.display_name || "Local Guide"}
                      {selectedLocal.is_verified && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">✓ Verified</Badge>
                      )}
                    </DialogTitle>
                    {selectedLocal.location && (
                      <DialogDescription className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {selectedLocal.location}
                      </DialogDescription>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {selectedLocal.bio && (
                  <p className="text-sm text-foreground">{selectedLocal.bio}</p>
                )}

                {selectedLocal.interests && selectedLocal.interests.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Interests</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLocal.interests.map((interest) => (
                        <Badge key={interest} variant="secondary" className="text-xs capitalize">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLocal.languages && selectedLocal.languages.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Languages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLocal.languages.map((lang) => (
                        <Badge key={lang} variant="outline" className="text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action */}
                {(() => {
                  const convo = getConvoStatus(selectedLocal.user_id);
                  if (convo?.accepted) {
                    return (
                      <Button className="w-full gap-2" onClick={() => navigate("/messages")}>
                        <MessageSquare className="w-4 h-4" />
                        Open Chat
                      </Button>
                    );
                  }
                  if (convo) {
                    return (
                      <Button className="w-full" variant="secondary" disabled>
                        Request Pending
                      </Button>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Introduce yourself — what would you like to ask or explore together?"
                        value={connectMessage}
                        onChange={(e) => setConnectMessage(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <Button
                        className="w-full gap-2"
                        onClick={handleConnect}
                        disabled={connectMutation.isPending}
                      >
                        <Send className="w-4 h-4" />
                        {connectMutation.isPending ? "Sending..." : "Request to Connect"}
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center">
                        Chat opens after the guide accepts your request
                      </p>
                    </div>
                  );
                })()}

                {/* View full profile link */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => {
                    setSelectedLocal(null);
                    navigate(`/user/${selectedLocal.user_id}`);
                  }}
                >
                  View full profile →
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

/* ---------- Local Card Component ---------- */

interface LocalCardProps {
  local: LocalProfile;
  reasons?: string[];
  convoStatus: any;
  onTap: () => void;
  onMessage: () => void;
  isSuggested?: boolean;
}

const LocalCard = ({ local, reasons, convoStatus, onTap, onMessage, isSuggested }: LocalCardProps) => {
  const connected = convoStatus?.accepted;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        isSuggested ? "border-primary/30 border" : "border border-border/60"
      )}
      onClick={onTap}
    >
      <CardContent className="p-4 space-y-2">
        {/* Suggestion reason */}
        {isSuggested && reasons && reasons.length > 0 && (
          <p className="text-[10px] text-primary font-medium bg-primary/10 rounded-full px-2.5 py-0.5 w-fit">
            💡 {reasons.slice(0, 2).join(" · ")}
          </p>
        )}

        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 shrink-0">
            <AvatarImage src={local.avatar_url || undefined} />
            <AvatarFallback>{local.display_name?.[0] || "?"}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm truncate">{local.display_name || "Local Guide"}</h3>
              {local.is_verified && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">✓</Badge>
              )}
            </div>

            {local.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" /> {local.location}
              </p>
            )}

            {local.bio && (
              <p className="text-xs text-muted-foreground line-clamp-2">{local.bio}</p>
            )}

            {local.interests && local.interests.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {local.interests.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                    {tag}
                  </Badge>
                ))}
                {local.interests.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{local.interests.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* Quick action */}
          <div className="shrink-0">
            {connected ? (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); onMessage(); }}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Chat
              </Button>
            ) : convoStatus ? (
              <Badge variant="outline" className="text-[10px]">Pending</Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); onTap(); }}
              >
                <Send className="w-3.5 h-3.5" /> Ask
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Match;
