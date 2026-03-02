import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const CreateExperience = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    city: "",
    duration: "",
    price: "",
    max_people: "",
    meeting_point: "",
    schedule: "",
    safety_guidelines: "",
    what_to_bring: "",
    language: "",
    itinerary: "",
  });

  const update = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    if (!user || !form.title.trim()) return;
    setSubmitting(true);
    try {
      const tags = form.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      const itinerary = form.itinerary.split("\n").map((l) => l.trim()).filter(Boolean);

      const payload: any = {
        host_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        tags,
        city: form.city.trim() || null,
        duration: form.duration.trim() || null,
        price: form.price.trim() || null,
        meeting_point: form.meeting_point.trim() || null,
        safety_guidelines: form.safety_guidelines.trim() || null,
        what_to_bring: form.what_to_bring.trim() || null,
        language: form.language.trim() || null,
        itinerary: itinerary.length ? itinerary : null,
      };
      if (form.max_people) payload.max_people = parseInt(form.max_people);
      if (form.schedule) payload.schedule = new Date(form.schedule).toISOString();

      const { data, error } = await supabase.from("experiences").insert(payload).select().single();
      if (error) throw error;
      toast({ title: "Experience created!", description: `"${data.title}" is live.` });
      navigate(`/experiences/${data.id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/experiences")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Create Experience</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Experience Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Hawker Culture Walk — Chinatown" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What will participants experience?" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Singapore" />
              </div>
              <div>
                <Label>Language</Label>
                <Input value={form.language} onChange={(e) => update("language", e.target.value)} placeholder="e.g. English, Mandarin" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date & Time</Label>
                <Input type="datetime-local" value={form.schedule} onChange={(e) => update("schedule", e.target.value)} />
              </div>
              <div>
                <Label>Duration</Label>
                <Input value={form.duration} onChange={(e) => update("duration", e.target.value)} placeholder="e.g. 2 hours" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max People</Label>
                <Input type="number" min="2" value={form.max_people} onChange={(e) => update("max_people", e.target.value)} placeholder="e.g. 6" />
              </div>
              <div>
                <Label>Price (optional)</Label>
                <Input value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="e.g. $15 or Free" />
              </div>
            </div>
            <div>
              <Label>Meeting Point</Label>
              <Input value={form.meeting_point} onChange={(e) => update("meeting_point", e.target.value)} placeholder="e.g. Chinatown MRT Exit A" />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="e.g. food, culture, walking" />
            </div>
            <div>
              <Label>Itinerary (one step per line)</Label>
              <Textarea value={form.itinerary} onChange={(e) => update("itinerary", e.target.value)} placeholder={"Meet at MRT\nVisit hawker stall #1\nTry kaya toast\nWalk to dessert spot"} rows={4} />
            </div>
            <div>
              <Label>What to Bring</Label>
              <Input value={form.what_to_bring} onChange={(e) => update("what_to_bring", e.target.value)} placeholder="e.g. Comfortable shoes, water bottle" />
            </div>
            <div>
              <Label>Safety Guidelines</Label>
              <Textarea value={form.safety_guidelines} onChange={(e) => update("safety_guidelines", e.target.value)} placeholder="e.g. Stay with the group, inform host of allergies" rows={2} />
            </div>

            <Button onClick={handleSubmit} disabled={submitting || !form.title.trim()} className="w-full">
              {submitting ? "Creating..." : "Create Experience"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CreateExperience;
