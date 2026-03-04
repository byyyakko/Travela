import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Sparkles, Clock, Utensils, Camera, ShoppingBag, Compass, Star, CalendarPlus, Check, Hotel, Car, Map, ExternalLink, ChevronDown, ChevronUp, Globe, Route, History, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { addDays, format, formatDistanceToNow } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import mascotCutesy from "@/assets/mascot-cutesy.png";
import { lazy, Suspense, useMemo } from "react";

const LazyItineraryRouteMap = lazy(() => import("@/components/map/ItineraryRouteMap"));

interface Activity {
  time: string;
  title: string;
  description: string;
  tip: string;
  category: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  summary?: string;
  source_url?: string;
}

interface Day {
  day: number;
  theme: string;
  activities: Activity[];
}

interface Accommodation {
  name: string;
  type: string;
  area: string;
  price_range: string;
  description: string;
  tip: string;
  booking_url?: string;
  latitude?: number;
  longitude?: number;
}

interface TransportMode {
  mode: string;
  description: string;
  estimated_cost: string;
  tip: string;
}

interface TransportInfo {
  from_airport: string;
  getting_around: string;
  modes: TransportMode[];
  day_travel_times?: { from: string; to: string; duration: string; recommended_mode: string }[];
}

interface ItineraryData {
  title: string;
  description: string;
  days: Day[];
  accommodations?: Accommodation[];
  transport?: TransportInfo;
}

const categoryIcons: Record<string, React.ElementType> = {
  food: Utensils,
  culture: Star,
  adventure: Compass,
  shopping: ShoppingBag,
  sightseeing: Camera,
  transport: Car,
};

const categoryColors: Record<string, string> = {
  food: "bg-orange-100 text-orange-700 border-orange-200",
  culture: "bg-purple-100 text-purple-700 border-purple-200",
  adventure: "bg-green-100 text-green-700 border-green-200",
  shopping: "bg-pink-100 text-pink-700 border-pink-200",
  sightseeing: "bg-blue-100 text-blue-700 border-blue-200",
  transport: "bg-amber-100 text-amber-700 border-amber-200",
};

const examplePrompts = [
  "3 days in Tokyo focusing on street food and hidden temples",
  "Weekend in Bangkok like a local, off the tourist trail",
  "Cultural deep-dive in Kyoto with tea ceremonies and gardens",
  "Food crawl through Singapore's hawker centers",
];

const SmartItinerary = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(() => {
    return sessionStorage.getItem("smart-itinerary-prompt") || "";
  });
  const [itinerary, setItinerary] = useState<ItineraryData | null>(() => {
    const saved = sessionStorage.getItem("smart-itinerary-data");
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(() => {
    return Number(sessionStorage.getItem("smart-itinerary-day")) || 1;
  });
  const [isAddingToPlanner, setIsAddingToPlanner] = useState(false);
  const [addedToPlanner, setAddedToPlanner] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [showMap, setShowMap] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch past itinerary history
  const { data: historyItems } = useQuery({
    queryKey: ["itinerary-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("itinerary_history" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Save itinerary to history
  const saveToHistory = useCallback(async (p: string, data: ItineraryData) => {
    if (!user) return;
    try {
      const { data: inserted, error } = await supabase
        .from("itinerary_history" as any)
        .insert({ user_id: user.id, prompt: p, title: data.title, itinerary_data: data as any })
        .select("id")
        .single();
      if (!error && inserted) {
        setCurrentHistoryId((inserted as any).id);
        queryClient.invalidateQueries({ queryKey: ["itinerary-history"] });
      }
    } catch { /* silent */ }
  }, [user, queryClient]);

  // Load a past itinerary
  const loadFromHistory = (item: any) => {
    setPrompt(item.prompt);
    setItinerary(item.itinerary_data as ItineraryData);
    setActiveDay(1);
    setAddedToPlanner(false);
    setCurrentHistoryId(item.id);
    setShowHistory(false);
  };

  // Delete a history item
  const deleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("itinerary_history" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["itinerary-history"] });
    if (currentHistoryId === id) setCurrentHistoryId(null);
    toast({ title: "Deleted", description: "Itinerary removed from history." });
  };

  // Compute map points for active day
  const mapPoints = useMemo(() => {
    if (!itinerary) return [];
    const day = itinerary.days?.find((d) => d.day === activeDay);
    if (!day) return [];
    return day.activities
      .map((a, idx) => ({
        lat: a.latitude ?? 0,
        lng: a.longitude ?? 0,
        title: a.title,
        time: a.time,
        category: a.category,
        order: idx,
      }))
      .filter((p) => p.lat !== 0 && p.lng !== 0);
  }, [itinerary, activeDay]);

  const toggleExpanded = (key: string) => {
    setExpandedActivities(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // Persist itinerary state to sessionStorage
  useEffect(() => {
    if (itinerary) {
      sessionStorage.setItem("smart-itinerary-data", JSON.stringify(itinerary));
    }
  }, [itinerary]);

  useEffect(() => {
    sessionStorage.setItem("smart-itinerary-prompt", prompt);
  }, [prompt]);

  useEffect(() => {
    sessionStorage.setItem("smart-itinerary-day", String(activeDay));
  }, [activeDay]);

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

      // Handle case where AI returned unparsed raw content
      let itineraryData = data;
      if (data?.raw && !data?.title) {
        try {
          let cleaned = data.raw;
          cleaned = cleaned.replace(/^[\s\S]*?```(?:json)?\s*\n?/i, "");
          cleaned = cleaned.replace(/\n?\s*```[\s\S]*$/i, "");
          cleaned = cleaned.trim();
          if (!cleaned.startsWith("{")) {
            const idx = cleaned.indexOf("{");
            if (idx !== -1) cleaned = cleaned.slice(idx);
          }
          itineraryData = JSON.parse(cleaned);
        } catch {
          toast({ title: "Error", description: "Failed to parse itinerary. Please try again.", variant: "destructive" });
          return;
        }
      }

      if (!itineraryData?.title || !itineraryData?.days) {
        toast({ title: "Error", description: "Incomplete itinerary received. Please try again.", variant: "destructive" });
        return;
      }

      setItinerary(itineraryData);
      setActiveDay(1);
      setAddedToPlanner(false);
      // Auto-save to history
      await saveToHistory(prompt.trim(), itineraryData);
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate itinerary. Try again!", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const addToPlanner = async () => {
    if (!itinerary || !user) return;
    setIsAddingToPlanner(true);

    try {
      const startDate = new Date();
      const endDate = addDays(startDate, itinerary.days.length - 1);

      // Extract country from title (best effort)
      const country = itinerary.title.replace(/^.*in\s+/i, "").trim() || "Unknown";

      // Create the trip
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          name: itinerary.title,
          country,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          notes: itinerary.description,
          status: "planned",
        })
        .select("id")
        .single();

      if (tripError) throw tripError;

      // Create itinerary items for each day/activity
      const items = itinerary.days.flatMap((day) =>
        day.activities.map((activity, idx) => ({
          trip_id: trip.id,
          user_id: user.id,
          day_date: format(addDays(startDate, day.day - 1), "yyyy-MM-dd"),
          title: activity.title,
          description: activity.description + (activity.tip ? `\n💡 ${activity.tip}` : ""),
          time: activity.time,
          category: activity.category || "activity",
          order_index: idx,
        }))
      );

      const { error: itemsError } = await supabase.from("itinerary_items").insert(items);
      if (itemsError) throw itemsError;

      setAddedToPlanner(true);
      toast({
        title: "Added to Planner! 🎉",
        description: "Your AI itinerary has been saved. You can edit it in the Plan tab.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsAddingToPlanner(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Smart Itinerary</h1>
            <p className="text-sm text-muted-foreground">AI-powered local travel plans</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="w-4 h-4" />
            History
          </Button>
        </div>

        {/* Past itineraries panel */}
        {showHistory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
            <Card className="p-4 cutesy-border bg-card/95 space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> Past Itineraries
              </h3>
              {!historyItems || historyItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">No saved itineraries yet. Generate one to get started!</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {historyItems.map((item: any) => (
                    <div
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50 hover:bg-secondary/50 ${
                        currentHistoryId === item.id ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.prompt}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={(e) => deleteHistoryItem(item.id, e)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}

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
            <div className="w-full overflow-x-auto scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
              <div className="flex gap-2 pb-3 min-w-max">
                {itinerary.days?.map((day) => (
                  <button
                    key={day.day}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      setActiveDay(day.day);
                    }}
                    className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border-2 select-none touch-manipulation ${
                      activeDay === day.day
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-secondary-foreground border-transparent hover:border-primary/50"
                    }`}
                  >
                    Day {day.day}
                  </button>
                ))}
              </div>
            </div>

            {/* Day theme */}
            {(itinerary.days || [])
              .filter((d) => d.day === activeDay)
              .map((day) => (
                <div key={day.day} className="space-y-3">
                  <p className="text-sm font-semibold text-primary">✨ {day.theme}</p>

                  {/* Route Map */}
                  {mapPoints.length > 0 && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowMap((v) => !v)}
                        className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                      >
                        <Route className="w-4 h-4" />
                        {showMap ? "Hide Route Map" : "Show Route Map"}
                      </button>
                      {showMap && (
                        <Suspense fallback={<div className="h-[300px] rounded-xl bg-secondary animate-pulse" />}>
                          <LazyItineraryRouteMap points={mapPoints} />
                        </Suspense>
                      )}
                    </div>
                  )}

                    {(day.activities || []).map((activity, idx) => {
                     const IconComp = categoryIcons[activity.category] || MapPin;
                     const colorClass = categoryColors[activity.category] || "bg-gray-100 text-gray-700 border-gray-200";
                     const expandKey = `${day.day}-${idx}`;
                     const isExpanded = expandedActivities.has(expandKey);
                     return (
                       <motion.div
                         key={idx}
                         initial={{ opacity: 0, x: -10 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ delay: idx * 0.08 }}
                       >
                         <Card
                           className="p-4 cutesy-border bg-card/95 cursor-pointer transition-shadow hover:shadow-md"
                           onClick={() => toggleExpanded(expandKey)}
                         >
                           <div className="flex items-start gap-3">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${colorClass} flex-shrink-0`}>
                               <IconComp className="w-5 h-5" />
                             </div>
                             <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between gap-2">
                                 <div className="flex items-center gap-2 mb-1">
                                   <Clock className="w-3 h-3 text-muted-foreground" />
                                   <span className="text-xs text-muted-foreground">{activity.time}</span>
                                 </div>
                                 {(activity.summary || activity.source_url) && (
                                   isExpanded
                                     ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                     : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                 )}
                               </div>
                               <h3 className="font-bold text-foreground">{activity.title}</h3>
                               <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                               {activity.tip && (
                                 <div className="mt-2 px-3 py-2 bg-secondary/50 rounded-lg">
                                   <p className="text-xs text-primary font-medium">💡 {activity.tip}</p>
                                 </div>
                               )}

                               {/* Expanded content */}
                               {isExpanded && (activity.summary || activity.source_url) && (
                                 <motion.div
                                   initial={{ opacity: 0, height: 0 }}
                                   animate={{ opacity: 1, height: "auto" }}
                                   exit={{ opacity: 0, height: 0 }}
                                   className="mt-3 space-y-2 border-t border-primary/10 pt-3"
                                 >
                                   {activity.summary && (
                                     <div className="px-3 py-2 bg-primary/5 rounded-lg">
                                       <p className="text-xs font-semibold text-primary mb-1">✨ AI Summary</p>
                                       <p className="text-sm text-foreground leading-relaxed">{activity.summary}</p>
                                     </div>
                                   )}
                                   {activity.source_url && (
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       className="gap-1.5 text-xs h-7 px-3"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         window.open(activity.source_url, "_blank", "noopener,noreferrer");
                                       }}
                                     >
                                       <Globe className="w-3 h-3" />
                                       View Source
                                     </Button>
                                   )}
                                 </motion.div>
                               )}

                               {activity.latitude && activity.longitude && (
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   className="mt-2 gap-1.5 text-xs h-7 px-2"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     const CATEGORY_TO_STORE: Record<string, string> = {
                                       food: "food",
                                       culture: "attractions",
                                       adventure: "attractions",
                                       shopping: "entertainment",
                                       sightseeing: "attractions",
                                     };
                                     const pin = {
                                       id: `pin-${activity.title}-${activity.latitude}`,
                                       name: activity.title,
                                       type: "ai" as const,
                                       storeType: CATEGORY_TO_STORE[activity.category] || "attractions",
                                       lat: activity.latitude,
                                       lng: activity.longitude,
                                       description: activity.location || activity.description,
                                     };
                                     const existing = JSON.parse(localStorage.getItem("saved-map-pins") || "[]");
                                     if (!existing.some((p: any) => p.id === pin.id)) {
                                       existing.push(pin);
                                       localStorage.setItem("saved-map-pins", JSON.stringify(existing));
                                     }
                                     navigate(`/map?lat=${activity.latitude}&lng=${activity.longitude}`);
                                   }}
                                 >
                                   <Map className="w-3 h-3" />
                                   Pin to Map
                                 </Button>
                               )}
                             </div>
                           </div>
                         </Card>
                       </motion.div>
                     );
                   })}
                </div>
              ))}

            {/* Accommodations */}
            {itinerary.accommodations && itinerary.accommodations.length > 0 && (
              <Card className="p-4 cutesy-border bg-card/95">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Hotel className="w-5 h-5 text-primary" /> Nearby Hotels & Accommodations
                </h3>
                <div className="space-y-3">
                  {(itinerary.accommodations || []).map((acc, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-secondary/50 border border-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{acc.name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{acc.type}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{acc.price_range}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{acc.area}</p>
                      <p className="text-sm mt-1">{acc.description}</p>
                      {acc.tip && <p className="text-xs text-primary mt-1">💡 {acc.tip}</p>}
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-7 px-2"
                          onClick={() => {
                            const url = acc.booking_url || `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(acc.name + " " + acc.area)}`;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Book Now
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs h-7 px-2"
                          onClick={() => {
                            if (acc.latitude && acc.longitude) {
                              const pin = {
                                id: `pin-hotel-${acc.name}-${acc.latitude}`,
                                name: acc.name,
                                type: "ai" as const,
                                storeType: "hotels",
                                lat: acc.latitude,
                                lng: acc.longitude,
                                description: `${acc.type} • ${acc.area}`,
                              };
                              const existing = JSON.parse(localStorage.getItem("saved-map-pins") || "[]");
                              if (!existing.some((p: any) => p.id === pin.id)) {
                                existing.push(pin);
                                localStorage.setItem("saved-map-pins", JSON.stringify(existing));
                              }
                              navigate(`/map?lat=${acc.latitude}&lng=${acc.longitude}`);
                            } else {
                              // Fallback: search by name
                              window.open(`https://www.google.com/maps/search/${encodeURIComponent(acc.name + " " + acc.area)}`, "_blank", "noopener,noreferrer");
                            }
                          }}
                        >
                          <Map className="w-3 h-3" />
                          View on Map
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Transport */}
            {itinerary.transport && (
              <Card className="p-4 cutesy-border bg-card/95">
                <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                  <Car className="w-5 h-5 text-primary" /> Getting Around
                </h3>
                <div className="space-y-3">
                  {itinerary.transport.from_airport && (
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="text-xs font-semibold text-primary mb-1">✈️ From Airport</p>
                      <p className="text-sm">{itinerary.transport.from_airport}</p>
                    </div>
                  )}
                  {itinerary.transport.getting_around && (
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="text-xs font-semibold text-primary mb-1">🚶 Getting Around</p>
                      <p className="text-sm">{itinerary.transport.getting_around}</p>
                    </div>
                  )}
                  {itinerary.transport.modes?.map((mode, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-secondary/50 border border-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{mode.mode}</span>
                        <Badge variant="outline" className="text-[10px]">{mode.estimated_cost}</Badge>
                      </div>
                      <p className="text-sm">{mode.description}</p>
                      {mode.tip && <p className="text-xs text-primary mt-1">💡 {mode.tip}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Add to Planner button */}
            <Card className="p-4 cutesy-border bg-card/95">
              {addedToPlanner ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="font-semibold text-foreground">Added to your Planner!</p>
                  <Button variant="outline" className="rounded-full" onClick={() => navigate("/planner")}>
                    View in Planner
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={addToPlanner}
                  disabled={isAddingToPlanner}
                  className="w-full rounded-full"
                  size="lg"
                >
                  <CalendarPlus className="w-5 h-5 mr-2" />
                  {isAddingToPlanner ? "Adding to Planner..." : "Add to Planner"}
                </Button>
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default SmartItinerary;
