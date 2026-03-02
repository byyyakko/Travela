import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Navigation,
  Loader2,
  LocateFixed,
  Star,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Building2,
  Train,
  Store,
  Hotel,
  UtensilsCrossed,
  Fuel,
  Trees,
  HelpCircle,
  DollarSign,
} from "lucide-react";

interface Toilet {
  name: string;
  type: string;
  distance_meters: number;
  estimated_walk_minutes: number;
  cleanliness: number;
  cleanliness_label: string;
  is_free: boolean;
  notes: string;
  directions: string;
  latitude: number;
  longitude: number;
}

const typeIcons: Record<string, React.ElementType> = {
  mall: Building2,
  station: Train,
  convenience_store: Store,
  hotel: Hotel,
  restaurant: UtensilsCrossed,
  gas_station: Fuel,
  public: Trees,
  other: HelpCircle,
};

const typeLabels: Record<string, string> = {
  mall: "Mall",
  station: "Station",
  convenience_store: "Convenience Store",
  hotel: "Hotel",
  restaurant: "Restaurant",
  gas_station: "Gas Station",
  public: "Public Toilet",
  other: "Other",
};

const cleanlinessColors: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-green-500",
  5: "text-emerald-500",
};

const ToiletFinder = () => {
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  const findMutation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number }) => {
      const { data, error } = await supabase.functions.invoke("find-toilets", {
        body: { latitude: coords.lat, longitude: coords.lng },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.toilets as Toilet[];
    },
    onSuccess: (data) => {
      setToilets(data);
      if (data.length === 0) {
        toast({ title: "No toilets found", description: "Try a different location." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error finding toilets", description: err.message, variant: "destructive" });
    },
  });

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(coords);
        setLocating(false);
        findMutation.mutate(coords);
      },
      (err) => {
        setLocating(false);
        toast({ title: "Location error", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openDirections = (toilet: Toilet) => {
    if (!userPos) return;
    const url = `https://www.google.com/maps/dir/${userPos.lat},${userPos.lng}/${toilet.latitude},${toilet.longitude}`;
    window.open(url, "_blank");
  };

  const renderStars = (count: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < count ? cleanlinessColors[count] + " fill-current" : "text-muted-foreground/30"}`}
      />
    ));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
            <DoorOpen className="w-5 h-5 text-primary" />
            <span className="font-bold text-primary">Toilet Finder</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Find the nearest clean restrooms around you
          </p>
        </div>

        {/* Locate button */}
        <div className="flex justify-center">
          <Button
            onClick={handleLocate}
            disabled={locating || findMutation.isPending}
            size="lg"
            className="rounded-full gap-2 px-8"
          >
            {locating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LocateFixed className="w-5 h-5" />
            )}
            {locating
              ? "Getting location..."
              : findMutation.isPending
              ? "Searching nearby toilets..."
              : "Find Toilets Near Me"}
          </Button>
        </div>

        {/* Loading state */}
        {findMutation.isPending && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Searching for nearby restrooms...</p>
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {toilets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <h2 className="text-lg font-bold">
                Found {toilets.length} restroom{toilets.length !== 1 ? "s" : ""} nearby
              </h2>

              {toilets.map((toilet, idx) => {
                const Icon = typeIcons[toilet.type] || HelpCircle;
                const isExpanded = expandedIdx === idx;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-md transition-shadow border-2"
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    >
                      <CardContent className="p-4">
                        {/* Header row */}
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm truncate">{toilet.name}</h3>
                              {idx === 0 && (
                                <Badge variant="default" className="text-[10px]">Nearest</Badge>
                              )}
                              {toilet.is_free ? (
                                <Badge variant="secondary" className="text-[10px]">Free</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] gap-0.5">
                                  <DollarSign className="w-3 h-3" /> Paid
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {toilet.distance_meters}m
                              </span>
                              <span>~{toilet.estimated_walk_minutes} min walk</span>
                              <span className="flex items-center gap-0.5">
                                {renderStars(toilet.cleanliness)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {typeLabels[toilet.type] || toilet.type} · {toilet.cleanliness_label}
                            </p>
                          </div>
                          <div className="shrink-0 text-muted-foreground">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {/* Expanded details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 pt-3 border-t border-border space-y-3">
                                {toilet.notes && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm">{toilet.notes}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                                    <Navigation className="w-3 h-3 inline mr-1" />
                                    Directions
                                  </p>
                                  <p className="text-sm">{toilet.directions}</p>
                                </div>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="w-full gap-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDirections(toilet);
                                  }}
                                >
                                  <Navigation className="w-4 h-4" />
                                  Open in Google Maps
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state after search */}
        {!findMutation.isPending && toilets.length === 0 && userPos && (
          <div className="text-center py-8 text-muted-foreground">
            <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No restrooms found nearby. Try again in a different area.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ToiletFinder;
