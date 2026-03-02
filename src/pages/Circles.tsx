import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, Users, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const FILTER_CHIPS = [
  "Food", "Culture", "Outdoors", "Night", "Arts", "Tech", "Study", "Volunteering",
];

const CHIP_COLORS: Record<string, string> = {
  Food: "bg-orange-100 text-orange-700 border-orange-200",
  Culture: "bg-purple-100 text-purple-700 border-purple-200",
  Outdoors: "bg-green-100 text-green-700 border-green-200",
  Night: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Arts: "bg-pink-100 text-pink-700 border-pink-200",
  Tech: "bg-blue-100 text-blue-700 border-blue-200",
  Study: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Volunteering: "bg-teal-100 text-teal-700 border-teal-200",
};

const Circles = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCircle, setNewCircle] = useState({ name: "", description: "", city: "", tags: "" });
  const [creating, setCreating] = useState(false);

  const { data: circles, isLoading, refetch } = useQuery({
    queryKey: ["circles", search, activeFilter],
    queryFn: async () => {
      let q = supabase.from("circles").select("*, circle_memberships(count)").order("created_at", { ascending: false });
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      if (activeFilter) q = q.contains("tags", [activeFilter.toLowerCase()]);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    if (!user || !newCircle.name.trim()) return;
    setCreating(true);
    try {
      const tags = newCircle.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      const { data, error } = await supabase.from("circles").insert({
        name: newCircle.name.trim(),
        description: newCircle.description.trim() || null,
        city: newCircle.city.trim() || null,
        tags,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      // Auto-join as host
      await supabase.from("circle_memberships").insert({
        user_id: user.id,
        circle_id: data.id,
        role: "host",
      });
      toast({ title: "Circle created!", description: `"${data.name}" is live.` });
      setShowCreate(false);
      setNewCircle({ name: "", description: "", city: "", tags: "" });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Circles</h1>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Create
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search circles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-full"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveFilter(activeFilter === chip ? null : chip)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all",
                activeFilter === chip
                  ? CHIP_COLORS[chip] || "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
              )}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Circle cards */}
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : !circles?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No circles found</p>
            <p className="text-sm mt-1">Create one to get started!</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {circles.map((circle: any, i: number) => (
              <motion.div
                key={circle.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 border-border/50"
                  onClick={() => navigate(`/circles/${circle.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <h3 className="font-bold text-base truncate">{circle.name}</h3>
                        {circle.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{circle.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {circle.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {circle.city}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {circle.circle_memberships?.[0]?.count || 0} members
                          </span>
                        </div>
                        {circle.tags?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {circle.tags.slice(0, 4).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {circle.cover_image && (
                        <img src={circle.cover_image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Circle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={newCircle.name} onChange={(e) => setNewCircle((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Hawker Explorers SG" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newCircle.description} onChange={(e) => setNewCircle((p) => ({ ...p, description: e.target.value }))} placeholder="What's this circle about?" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={newCircle.city} onChange={(e) => setNewCircle((p) => ({ ...p, city: e.target.value }))} placeholder="e.g. Singapore" />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input value={newCircle.tags} onChange={(e) => setNewCircle((p) => ({ ...p, tags: e.target.value }))} placeholder="e.g. food, culture, outdoors" />
            </div>
            <Button onClick={handleCreate} disabled={creating || !newCircle.name.trim()} className="w-full">
              {creating ? "Creating..." : "Create Circle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Circles;
