import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, MapPin, Locate, Users, Store, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Place {
  id: string;
  name: string;
  type: "store" | "local" | "itinerary";
  storeType?: "food" | "attractions" | "entertainment";
  lat: number;
  lng: number;
  description?: string;
}

// Lazy load the map component to avoid SSR issues
const LazyMapComponent = lazy(() => import("@/components/map/MapComponent"));

const MapView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "stores" | "locals">("all");

  // Default to Singapore if no location
  const defaultPosition: [number, number] = [1.3521, 103.8198];

  // Fetch stores for map markers
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

  // Fetch user's itinerary items for today
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

  // Generate coordinates for places
  const places: Place[] = [
    // Stores - use real coordinates if available, otherwise generate mock ones
    ...(stores?.map((store) => ({
      id: store.id,
      name: store.store_name,
      type: "store" as const,
      storeType: store.store_type as "food" | "attractions" | "entertainment",
      // Use real coordinates if available, otherwise generate random ones around Singapore
      lat: store.latitude || (1.3521 + (Math.random() - 0.5) * 0.05),
      lng: store.longitude || (103.8198 + (Math.random() - 0.5) * 0.05),
      description: store.address || store.store_type,
    })) || []),
    // Itinerary locations
    ...(itineraryItems?.filter(item => item.location).slice(0, 3).map((item) => ({
      id: item.id,
      name: item.title,
      type: "itinerary" as const,
      lat: 1.3521 + (Math.random() - 0.5) * 0.03,
      lng: 103.8198 + (Math.random() - 0.5) * 0.03,
      description: item.location || undefined,
    })) || []),
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
          toast({
            title: "Location found! 📍",
            description: "Map centered on your current location",
          });
        },
        (error) => {
          setIsLocating(false);
          toast({
            title: "Location error",
            description: "Could not get your location. Please enable GPS.",
            variant: "destructive",
          });
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const filteredPlaces = places.filter((place) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "stores") return place.type === "store";
    if (activeFilter === "locals") return place.type === "itinerary";
    return true;
  });

  const mapCenter = userPosition || defaultPosition;

  return (
    <AppLayout>
      <div className="space-y-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary">Explore Map</h1>
              <p className="text-sm text-muted-foreground">Find places near you</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="gap-2"
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Locate className="w-4 h-4" />
            )}
            My Location
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2">
          {[
            { id: "all", label: "All Places", icon: MapPin },
            { id: "stores", label: "Stores", icon: Store },
            { id: "locals", label: "My Plans", icon: Navigation },
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

          {/* Loading overlay */}
          {isLocating && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-8 h-8 text-primary" />
              </motion.div>
            </div>
          )}
        </Card>

        {/* Places List */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-primary">Nearby Places</h2>
          {filteredPlaces.length === 0 ? (
            <Card className="p-4 cutesy-border text-center">
              <p className="text-muted-foreground text-sm">
                No places to show. Try adding stores or planning an itinerary!
              </p>
            </Card>
          ) : (
            <div className="grid gap-2">
              {filteredPlaces.slice(0, 5).map((place) => (
                <Card key={place.id} className="p-3 cutesy-border flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    place.type === "store" ? "bg-blue-100" : "bg-green-100"
                  }`}>
                    {place.type === "store" ? (
                      <Store className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Navigation className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{place.name}</p>
                    {place.description && (
                      <p className="text-xs text-muted-foreground truncate">{place.description}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default MapView;
