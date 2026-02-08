import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Sparkles, ArrowLeft, Clock, Utensils, Camera, ShoppingBag, Compass, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import mascotCutesy from "@/assets/mascot-cutesy.png";

interface Activity {
  time: string;
  title: string;
  description: string;
  tip: string;
  category: string;
}

interface Day {
  day: number;
  theme: string;
  activities: Activity[];
}

interface ItineraryData {
  title: string;
  description: string;
  days: Day[];
}

const categoryIcons: Record<string, React.ElementType> = {
  food: Utensils,
  culture: Star,
  adventure: Compass,
  shopping: ShoppingBag,
  sightseeing: Camera,
};

const categoryColors: Record<string, string> = {
  food: "bg-orange-100 text-orange-700 border-orange-200",
  culture: "bg-purple-100 text-purple-700 border-purple-200",
  adventure: "bg-green-100 text-green-700 border-green-200",
  shopping: "bg-pink-100 text-pink-700 border-pink-200",
  sightseeing: "bg-blue-100 text-blue-700 border-blue-200",
};

const examplePrompts = [
  "3 days in Tokyo focusing on street food and hidden temples",
  "Weekend in Bangkok like a local, off the tourist trail",
  "Cultural deep-dive in Kyoto with tea ceremonies and gardens",
  "Food crawl through Singapore's hawker centers",
];

const SmartItinerary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(1);

  const generateItinerary = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setItinerary(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-travel", {
        body: { type: "itinerary", prompt: prompt.trim() },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }

      setItinerary(data);
      setActiveDay(1);
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate itinerary. Try again!", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Smart Itinerary</h1>
            <p className="text-sm text-muted-foreground">AI-powered local travel plans</p>
          </div>
        </div>

        {/* Travela Plus badge */}
        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          <Star className="w-3 h-3 mr-1" /> Travela Plus Feature — Unlocked ✨
        </Badge>

        {/* Prompt input */}
        <Card className="p-5 cutesy-border bg-card/95">
          <div className="flex items-start gap-3 mb-4">
            <motion.img
              src={mascotCutesy}
              alt="Mascot"
              className="w-14 h-14 object-contain mix-blend-multiply"
              animate={{ y: [0, -6, 0], transition: { duration: 2.5, repeat: Infinity } }}
            />
            <div>
              <h2 className="font-bold text-foreground">Where do you want to explore?</h2>
              <p className="text-sm text-muted-foreground">Describe your ideal trip and I'll plan it like a local!</p>
            </div>
          </div>

          <Textarea
            placeholder="e.g., 3 days in Tokyo focusing on street food and hidden temples..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="border-2 border-primary/50 rounded-xl min-h-[100px] mb-3"
          />

          {/* Example prompts */}
          <div className="flex flex-wrap gap-2 mb-4">
            {examplePrompts.map((ep) => (
              <button
                key={ep}
                onClick={() => setPrompt(ep)}
                className="px-3 py-1 rounded-full text-xs bg-secondary hover:bg-secondary/80 transition-colors border border-primary/20"
              >
                {ep}
              </button>
            ))}
          </div>

          <Button onClick={generateItinerary} disabled={!prompt.trim() || isLoading} className="w-full rounded-full">
            <Sparkles className="w-4 h-4 mr-2" />
            {isLoading ? "Crafting your itinerary..." : "Generate Itinerary"}
          </Button>
        </Card>

        {/* Loading */}
        {isLoading && (
          <Card className="p-8 text-center cutesy-border bg-card/95">
            <motion.img
              src={mascotCutesy}
              alt="Loading"
              className="w-20 h-20 mx-auto mb-4 object-contain mix-blend-multiply"
              animate={{ y: [0, -8, 0], transition: { duration: 1.5, repeat: Infinity } }}
            />
            <p className="text-muted-foreground">Planning your perfect trip... 🗺️</p>
          </Card>
        )}

        {/* Itinerary result */}
        {itinerary && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="p-4 cutesy-border bg-card/95">
              <h2 className="text-lg font-bold text-primary">{itinerary.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{itinerary.description}</p>
            </Card>

            {/* Day tabs */}
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {itinerary.days.map((day) => (
                  <button
                    key={day.day}
                    onClick={() => setActiveDay(day.day)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border-2 ${
                      activeDay === day.day
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-secondary-foreground border-transparent hover:border-primary/50"
                    }`}
                  >
                    Day {day.day}
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Day theme */}
            {itinerary.days
              .filter((d) => d.day === activeDay)
              .map((day) => (
                <div key={day.day} className="space-y-3">
                  <p className="text-sm font-semibold text-primary">✨ {day.theme}</p>
                  {day.activities.map((activity, idx) => {
                    const IconComp = categoryIcons[activity.category] || MapPin;
                    const colorClass = categoryColors[activity.category] || "bg-gray-100 text-gray-700 border-gray-200";
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08 }}
                      >
                        <Card className="p-4 cutesy-border bg-card/95">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${colorClass} flex-shrink-0`}>
                              <IconComp className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{activity.time}</span>
                              </div>
                              <h3 className="font-bold text-foreground">{activity.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                              {activity.tip && (
                                <div className="mt-2 px-3 py-2 bg-secondary/50 rounded-lg">
                                  <p className="text-xs text-primary font-medium">💡 {activity.tip}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default SmartItinerary;
