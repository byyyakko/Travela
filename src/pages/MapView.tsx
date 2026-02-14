import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation, MapPin, Locate, Store, ArrowLeft, Loader2, Sparkles, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Place {
  id: string;
  name: string;
  type: "store" | "local" | "itinerary" | "ai";
  storeType?: "food" | "attractions" | "entertainment";
  lat: number;
  lng: number;
  description?: string;
}

const LazyMapComponent = lazy(() => import("@/components/map/MapComponent"));

const CATEGORY_MAP: Record<string, "food" | "attractions" | "entertainment"> = {
  "Attractions": "attractions",
  "Food & Cuisine": "food",
  "Nightlife": "entertainment",
  "Wellness": "attractions",
  "Hiking": "attractions",
  "Beaches": "attractions",
};

const MapView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "stores" | "locals" | "ai">("all");
  const [countrySearch, setCountrySearch] = useState("");
  const [aiPlaces, setAiPlaces] = useState<Place[]>([]);

  const defaultPosition: [number, number] = [1.3521, 103.8198];

  const { data: stores } = useQuery({
    queryKey: ["mapStores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, store_name, store_type, phone, address, latitude, longitude");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: itineraryItems } = useQuery({
    queryKey: ["mapItinerary", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("itinerary_items")
        .select("id, title, location, description")
        .eq("user_id", user.id)
        .eq("day_date", today);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const discoverMutation = useMutation({
    mutationFn: async (country: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in to discover places");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-travel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ type: "explore-attractions", country }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to discover places");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data?.attractions?.length) {
        const newPlaces: Place[] = data.attractions
          .filter((a: any) => a.latitude && a.longitude)
          .map((a: any, i: number) => ({
            id: `ai-${i}-${a.name}`,
            name: a.name,
            type: "ai" as const,
            storeType: CATEGORY_MAP[a.category] || "attractions",
            lat: a.latitude,
            lng: a.longitude,
            description: a.description,
          }));
        
        setAiPlaces(newPlaces);
        setActiveFilter("ai");

        // Center map on first AI place
        if (newPlaces.length > 0) {
          setUserPosition(null); // Let map re-center
        }

        toast({
          title: `Found ${newPlaces.length} places! ✨`,
          description: `Showing AI-recommended spots in ${data.country || countrySearch}`,
        });
      } else {
        toast({
          title: "No places found",
          description: "Try a different country name",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Discovery failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const places: Place[] = [
    ...(stores?.map((store) => ({
      id: store.id,
      name: store.store_name,
      type: "store" as const,
      storeType: store.store_type as "food" | "attractions" | "entertainment",
      lat: store.latitude || (1.3521 + (Math.random() - 0.5) * 0.05),
      lng: store.longitude || (103.8198 + (Math.random() - 0.5) * 0.05),
      description: store.address || store.store_type,
    })) || []),
    ...(itineraryItems?.filter(item => item.location).slice(0, 3).map((item) => ({
      id: item.id,
      name: item.title,
      type: "itinerary" as const,
      lat: 1.3521 + (Math.random() - 0.5) * 0.03,
      lng: 103.8198 + (Math.random() - 0.5) * 0.03,
      description: item.location || undefined,
    })) || []),
    ...aiPlaces,
  ];

  const handleLocationFound = useCallback((lat: number, lng: number) => {
    setUserPosition([lat, lng]);
    setIsLocating(false);
  }, []);

  const handleLocateMe = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserPosition([position.coords.latitude, position.coords.longitude]);
          setIsLocating(false);
          toast({ title: "Location found! 📍", description: "Map centered on your current location" });
        },
        () => {
          setIsLocating(false);
          toast({ title: "Location error", description: "Could not get your location. Please enable GPS.", variant: "destructive" });
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleDiscover = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = countrySearch.trim();
    if (!trimmed) return;
    discoverMutation.mutate(trimmed);
  };

  const filteredPlaces = places.filter((place) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "stores") return place.type === "store";
    if (activeFilter === "locals") return place.type === "itinerary";
    if (activeFilter === "ai") return place.type === "ai";
    return true;
  });

  // Center on AI places if they exist and filter is "ai"
  const mapCenter: [number, number] = 
    activeFilter === "ai" && aiPlaces.length > 0
      ? [aiPlaces[0].lat, aiPlaces[0].lng]
      : userPosition || defaultPosition;

  return (
    <AppLayout>
      <div className="space-y-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">Explore Map</h1>
              <p className="text-sm text-muted-foreground">Find places near you</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLocateMe} disabled={isLocating} className="gap-2">
            {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Locate className="w-4 h-4" />}
            My Location
          </Button>
        </div>

        {/* AI Discovery Search */}
        <Card className="p-3 cutesy-border">
          <form onSubmit={handleDiscover} className="flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Discover places in a country..."
                className="pl-9 rounded-full border-primary/30"
                disabled={discoverMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={discoverMutation.isPending || !countrySearch.trim()}
              className="gap-1.5 rounded-full"
            >
              {discoverMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Discover
            </Button>
          </form>
        </Card>

        {/* Filter Pills */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "all", label: "All Places", icon: MapPin },
            { id: "stores", label: "Stores", icon: Store },
            { id: "locals", label: "My Plans", icon: Navigation },
            { id: "ai", label: "AI Picks", icon: Sparkles, count: aiPlaces.length },
          ].map((filter) => (
            <Button
              key={filter.id}
              variant={activeFilter === filter.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filter.id as typeof activeFilter)}
              className="gap-1.5"
            >
              <filter.icon className="w-3.5 h-3.5" />
              {filter.label}
              {filter.count ? (
                <span className="ml-1 text-[10px] bg-primary-foreground/20 rounded-full px-1.5">
                  {filter.count}
                </span>
              ) : null}
            </Button>
          ))}
        </div>

        {/* Map Container */}
        <Card className="cutesy-border overflow-hidden h-[60vh] relative">
          <Suspense fallback={
            <div className="h-full w-full flex items-center justify-center bg-muted">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          }>
            <LazyMapComponent
              center={mapCenter}
              userPosition={userPosition}
              places={filteredPlaces}
              onLocationFound={handleLocationFound}
            />
          </Suspense>

          {isLocating && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Loader2 className="w-8 h-8 text-primary" />
              </motion.div>
            </div>
          )}
        </Card>

        {/* Places List */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-primary">
            {activeFilter === "ai" ? "AI-Discovered Places" : "Nearby Places"}
          </h2>
          {filteredPlaces.length === 0 ? (
            <Card className="p-4 cutesy-border text-center">
              <p className="text-muted-foreground text-sm">
                {activeFilter === "ai"
                  ? "Search for a country above to discover AI-recommended places! ✨"
                  : "No places to show. Try adding stores or planning an itinerary!"}
              </p>
            </Card>
          ) : (
            <div className="grid gap-2">
              {filteredPlaces.slice(0, 10).map((place) => {
                let emoji = "📋";
                let bgClass = "bg-secondary";
                let textClass = "text-foreground";
                
                if (place.type === "store" || place.type === "ai") {
                  switch (place.storeType) {
                    case "food":
                      emoji = "🍜";
                      bgClass = "bg-orange-100 dark:bg-orange-950";
                      textClass = "text-orange-600";
                      break;
                    case "attractions":
                      emoji = "🏛️";
                      bgClass = "bg-purple-100 dark:bg-purple-950";
                      textClass = "text-purple-600";
                      break;
                    case "entertainment":
                      emoji = "🎮";
                      bgClass = "bg-pink-100 dark:bg-pink-950";
                      textClass = "text-pink-600";
                      break;
                  }
                }

                return (
                  <Card key={place.id} className="p-3 cutesy-border flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bgClass}`}>
                      <span className="text-lg">{emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">{place.name}</p>
                        {place.type === "ai" && (
                          <Sparkles className="w-3 h-3 text-primary shrink-0" />
                        )}
                      </div>
                      {place.description && (
                        <p className="text-xs text-muted-foreground truncate">{place.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full capitalize shrink-0">
                      {place.storeType || place.type}
                    </span>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default MapView;
