import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  ExternalLink, 
  Star, 
  UtensilsCrossed, 
  Landmark, 
  Wine,
  Navigation,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const storeTypeIcons = {
  food: UtensilsCrossed,
  attractions: Landmark,
  entertainment: Wine,
};

const storeTypeLabels = {
  food: "Food & Dining",
  attractions: "Attractions",
  entertainment: "Nightlife",
};

const storeTypeColors = {
  food: "bg-pink-100 text-pink-700 border-pink-300",
  attractions: "bg-blue-100 text-blue-700 border-blue-300",
  entertainment: "bg-purple-100 text-purple-700 border-purple-300",
};

interface Store {
  id: string;
  store_name: string;
  store_type: "food" | "attractions" | "entertainment";
  description: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  website_url: string | null;
  subscription_tier: string;
  latitude: number | null;
  longitude: number | null;
}

interface StoreImage {
  id: string;
  image_url: string;
  caption: string | null;
}

interface StoreItem {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  ordering_tip: string | null;
  image_url: string | null;
}

const StoreView = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch store details
  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId)
        .single();

      if (error) throw error;
      return data as Store;
    },
    enabled: !!storeId,
  });

  // Fetch store images
  const { data: storeImages } = useQuery({
    queryKey: ["store-images", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_images")
        .select("*")
        .eq("store_id", storeId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as StoreImage[];
    },
    enabled: !!storeId,
  });

  // Fetch store items/products
  const { data: storeItems } = useQuery({
    queryKey: ["store-items", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_items")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as StoreItem[];
    },
    enabled: !!storeId,
  });

  // Record visit
  useEffect(() => {
    if (storeId) {
      supabase.from("store_visits").insert({
        store_id: storeId,
        page_viewed: "store_page",
      });
    }
  }, [storeId]);

  const handleViewOnMap = () => {
    if (store?.latitude && store?.longitude) {
      navigate(`/map?lat=${store.latitude}&lng=${store.longitude}&store=${store.id}`);
    } else {
      navigate("/map");
    }
  };

  const nextImage = () => {
    if (storeImages && storeImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % storeImages.length);
    }
  };

  const prevImage = () => {
    if (storeImages && storeImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + storeImages.length) % storeImages.length);
    }
  };

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-orange-50 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-pink-600 text-lg">Store not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const Icon = storeTypeIcons[store.store_type];
  const isPremium = store.subscription_tier === "tier_2";

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-orange-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-pink-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-pink-600 hover:bg-pink-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-pink-700 truncate flex-1">{store.store_name}</h1>
          {isPremium && (
            <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 gap-1">
              <Star className="w-3 h-3 fill-current" />
              Featured
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Image Gallery */}
        {storeImages && storeImages.length > 0 && (
          <div className="relative">
            <div className="aspect-video rounded-2xl overflow-hidden border-2 border-pink-200">
              <img
                src={storeImages[currentImageIndex].image_url}
                alt={store.store_name}
                className="w-full h-full object-cover"
              />
            </div>
            {storeImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hover:bg-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-pink-600" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg hover:bg-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-pink-600" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {storeImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        idx === currentImageIndex ? "bg-white" : "bg-white/50"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Store Info Card */}
        <Card className="border-pink-200 bg-white/80 backdrop-blur">
          <CardContent className="p-5 space-y-4">
            {/* Type Badge */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center border-2",
                storeTypeColors[store.store_type]
              )}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-pink-700">{store.store_name}</h2>
                <Badge 
                  variant="outline" 
                  className={cn("capitalize text-xs", storeTypeColors[store.store_type])}
                >
                  {storeTypeLabels[store.store_type]}
                </Badge>
              </div>
            </div>

            {/* Description */}
            {store.description && (
              <p className="text-gray-600 leading-relaxed">{store.description}</p>
            )}

            {/* Contact Info */}
            <div className="space-y-2">
              {store.address && (
                <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-xl">
                  <MapPin className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-pink-700">Address</p>
                    <p className="text-sm text-gray-600">{store.address}</p>
                    {store.country && (
                      <p className="text-xs text-pink-400 mt-1">{store.country}</p>
                    )}
                  </div>
                </div>
              )}

              {store.phone && (
                <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-xl">
                  <Phone className="w-5 h-5 text-pink-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-pink-700">Phone</p>
                    <a 
                      href={`tel:${store.phone}`}
                      className="text-sm text-pink-600 hover:underline"
                    >
                      {store.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleViewOnMap}
                className="flex-1 gap-2 bg-pink-500 hover:bg-pink-600 rounded-full"
              >
                <Navigation className="w-4 h-4" />
                View on Map
              </Button>
              {store.website_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(store.website_url!, "_blank")}
                  className="gap-2 border-pink-300 text-pink-600 hover:bg-pink-50 rounded-full"
                >
                  <ExternalLink className="w-4 h-4" />
                  Website
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Menu/Products Section */}
        {storeItems && storeItems.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-pink-700 flex items-center gap-2">
              {store.store_type === "food" ? "🍽️ Menu" : "📋 What's Offered"}
            </h3>
            <div className="space-y-3">
              {storeItems.map((item) => (
                <Card key={item.id} className="border-pink-200 bg-white/80 overflow-hidden">
                  <div className="flex">
                    {item.image_url && (
                      <div className="w-24 h-24 shrink-0">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardContent className={cn("flex-1 p-3", !item.image_url && "p-4")}>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-pink-700">{item.name}</h4>
                        {item.price && (
                          <span className="text-sm font-semibold text-pink-600 shrink-0">
                            {item.price}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                      )}
                      {item.ordering_tip && (
                        <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded-lg inline-block">
                          💡 {item.ordering_tip}
                        </p>
                      )}
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreView;