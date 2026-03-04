import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Users, MapPin, Calendar, Clock, UserPlus, LogOut, Plus, HelpCircle, Hand, CalendarCheck } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const POST_TYPE_META: Record<string, { icon: any; label: string; color: string }> = {
  availability: { icon: Hand, label: "Available", color: "bg-green-100 text-green-700" },
  question: { icon: HelpCircle, label: "Question", color: "bg-blue-100 text-blue-700" },
  meetup: { icon: CalendarCheck, label: "Meetup", color: "bg-purple-100 text-purple-700" },
};

const CircleDetail = () => {
  const { circleId } = useParams<{ circleId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPost, setNewPost] = useState({ post_type: "question", text: "", location: "", date_time: "", max_people: "" });

  // Fetch circle
  const { data: circle, isLoading } = useQuery({
    queryKey: ["circle", circleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("circles").select("*").eq("id", circleId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!circleId,
  });

  // Fetch membership
  const { data: membership } = useQuery({
    queryKey: ["circle-membership", circleId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("circle_memberships")
        .select("*")
        .eq("circle_id", circleId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!circleId && !!user,
  });

  const isMember = !!membership;

  // Fetch posts
  const { data: posts } = useQuery({
    queryKey: ["circle-posts", circleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_posts")
        .select("*")
        .eq("circle_id", circleId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch author profiles
      const authorIds = [...new Set(data.map((p: any) => p.author_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", authorIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      return data.map((p: any) => ({ ...p, author: profileMap[p.author_id] }));
    },
    enabled: !!circleId && isMember,
  });

  // Fetch members
  const { data: members } = useQuery({
    queryKey: ["circle-members", circleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("circle_memberships")
        .select("*")
        .eq("circle_id", circleId!)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      const userIds = data.map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      return data.map((m: any) => ({ ...m, profile: profileMap[m.user_id] }));
    },
    enabled: !!circleId && isMember,
  });

  // Join
  const joinMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("circle_memberships").insert({ user_id: user!.id, circle_id: circleId!, role: "member" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Joined!" });
      qc.invalidateQueries({ queryKey: ["circle-membership", circleId] });
      qc.invalidateQueries({ queryKey: ["circle-members", circleId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Leave
  const leaveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("circle_memberships").delete().eq("user_id", user!.id).eq("circle_id", circleId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Left circle" });
      qc.invalidateQueries({ queryKey: ["circle-membership", circleId] });
      qc.invalidateQueries({ queryKey: ["circle-members", circleId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Create post
  const createPostMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        circle_id: circleId!,
        author_id: user!.id,
        post_type: newPost.post_type,
        text: newPost.text.trim(),
      };
      if (newPost.location.trim()) payload.location = newPost.location.trim();
      if (newPost.date_time) payload.date_time = new Date(newPost.date_time).toISOString();
      if (newPost.max_people) payload.max_people = parseInt(newPost.max_people);
      const { error } = await supabase.from("circle_posts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Post created!" });
      setShowCreatePost(false);
      setNewPost({ post_type: "question", text: "", location: "", date_time: "", max_people: "" });
      qc.invalidateQueries({ queryKey: ["circle-posts", circleId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <AppLayout><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-60 rounded-xl mt-4" /></AppLayout>;
  }

  if (!circle) {
    return <AppLayout><p className="text-center py-16 text-muted-foreground">Circle not found.</p></AppLayout>;
  }

  const feedPosts = posts?.filter((p: any) => p.post_type !== "meetup") || [];
  const meetupPosts = posts?.filter((p: any) => p.post_type === "meetup") || [];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="space-y-3">
          {circle.cover_image && (
            <img src={circle.cover_image} alt="" className="w-full h-36 rounded-xl object-cover" />
          )}
          <div>
            <h1 className="text-2xl font-bold">{circle.name}</h1>
            {circle.description && <p className="text-sm text-muted-foreground mt-1">{circle.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {circle.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{circle.city}</span>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{members?.length || 0} members</span>
            </div>
            {circle.tags?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {circle.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="capitalize text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Join / Leave */}
          {!isMember ? (
            <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} className="w-full gap-2">
              <UserPlus className="w-4 h-4" /> Join Circle
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} className="gap-1 text-destructive">
                <LogOut className="w-4 h-4" /> Leave
              </Button>
              <Badge variant="secondary" className="ml-auto capitalize">{membership?.role}</Badge>
            </div>
          )}
        </div>

        {/* Tabs - only visible to members */}
        {isMember ? (
          <Tabs defaultValue="feed" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="feed" className="flex-1">Feed</TabsTrigger>
              <TabsTrigger value="meetups" className="flex-1">Meetups</TabsTrigger>
              <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
            </TabsList>

            {/* Feed Tab */}
            <TabsContent value="feed" className="space-y-3 mt-3">
              <Button size="sm" variant="outline" onClick={() => { setNewPost((p) => ({ ...p, post_type: "question" })); setShowCreatePost(true); }} className="gap-1">
                <Plus className="w-4 h-4" /> New Post
              </Button>
              {feedPosts.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">No posts yet. Start the conversation!</p>
              ) : (
                feedPosts.map((post: any, i: number) => {
                  const meta = POST_TYPE_META[post.post_type] || POST_TYPE_META.question;
                  const Icon = meta.icon;
                  return (
                    <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <Card className="border border-border/60">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={post.author?.avatar_url} />
                              <AvatarFallback>{post.author?.display_name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{post.author?.display_name || "Anonymous"}</span>
                            <Badge className={cn("text-[10px] px-1.5 py-0 ml-auto", meta.color)}>
                              <Icon className="w-3 h-3 mr-0.5" />{meta.label}
                            </Badge>
                          </div>
                          <p className="text-sm">{post.text}</p>
                          {post.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{post.location}</p>
                          )}
                          {post.date_time && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(post.date_time), "PPp")}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">{format(new Date(post.created_at), "MMM d, h:mm a")}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </TabsContent>

            {/* Meetups Tab */}
            <TabsContent value="meetups" className="space-y-3 mt-3">
              <Button size="sm" variant="outline" onClick={() => { setNewPost((p) => ({ ...p, post_type: "meetup" })); setShowCreatePost(true); }} className="gap-1">
                <Plus className="w-4 h-4" /> Create Meetup
              </Button>
              {meetupPosts.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">No meetups planned yet.</p>
              ) : (
                meetupPosts.map((post: any, i: number) => (
                  <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card
                      className="border-2 border-purple-200 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/circles/${circleId}/meetup/${post.id}`)}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={post.author?.avatar_url} />
                            <AvatarFallback>{post.author?.display_name?.[0] || "?"}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{post.author?.display_name || "Anonymous"}</span>
                          <Badge className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0 ml-auto">
                            <CalendarCheck className="w-3 h-3 mr-0.5" />Meetup
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{post.text}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {post.date_time && (
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(post.date_time), "PPp")}</span>
                          )}
                          {post.location && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{post.location}</span>
                          )}
                          {post.max_people && (
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />Max {post.max_people}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="space-y-2 mt-3">
              {members?.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <Avatar className="w-9 h-9 cursor-pointer" onClick={() => navigate(`/user/${m.user_id}`)}>
                    <AvatarImage src={m.profile?.avatar_url} />
                    <AvatarFallback>{m.profile?.display_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.profile?.display_name || "User"}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize text-[10px]">{m.role}</Badge>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">Join this circle to see posts, meetups, and members.</p>
          </div>
        )}
      </div>

      {/* Create Post Dialog */}
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newPost.post_type === "meetup" ? "Create Meetup" : "New Post"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={newPost.post_type} onValueChange={(v) => setNewPost((p) => ({ ...p, post_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="availability">Availability</SelectItem>
                  <SelectItem value="meetup">Meetup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{newPost.post_type === "meetup" ? "Title / Description" : "What's on your mind?"}</Label>
              <Textarea value={newPost.text} onChange={(e) => setNewPost((p) => ({ ...p, text: e.target.value }))} placeholder={newPost.post_type === "availability" ? "e.g. Free Tue 7pm, want hawker dinner" : newPost.post_type === "meetup" ? "e.g. Weekend cycling at ECP" : "e.g. Where to find good kaya toast?"} />
            </div>
            {(newPost.post_type === "meetup" || newPost.post_type === "availability") && (
              <>
                <div>
                  <Label>Date & Time</Label>
                  <Input type="datetime-local" value={newPost.date_time} onChange={(e) => setNewPost((p) => ({ ...p, date_time: e.target.value }))} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={newPost.location} onChange={(e) => setNewPost((p) => ({ ...p, location: e.target.value }))} placeholder="e.g. Maxwell Food Centre" />
                </div>
              </>
            )}
            {newPost.post_type === "meetup" && (
              <div>
                <Label>Max People</Label>
                <Input type="number" min="2" value={newPost.max_people} onChange={(e) => setNewPost((p) => ({ ...p, max_people: e.target.value }))} placeholder="e.g. 6" />
              </div>
            )}
            <Button onClick={() => createPostMutation.mutate()} disabled={createPostMutation.isPending || !newPost.text.trim()} className="w-full">
              {createPostMutation.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CircleDetail;
