import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/dataClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Phone, ExternalLink, Star, UtensilsCrossed, Landmark, Wine, Navigation, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const storeTypeIcons = { food: UtensilsCrossed, attractions: Landmark, entertainment: Wine };
const storeTypeLabels = { food: "Food & Dining", attractions: "Attractions", entertainment: "Nightlife" };
const storeTypeColors = {
  food: "bg-primary/10 text-primary border-primary/30",
  attractions: "bg-accent/10 text-accent border-accent/30",
  entertainment: "bg-ring/10 text-ring border-ring/30",
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
  dietary_options: string[] | null;
}

const dietaryLabels: Record<string, { label: string; emoji: string; color: string }> = {
  vegan: { label: "Vegan Friendly", emoji: "🌱", color: "bg-green-100 text-green-700 border-green-300" },
  vegetarian: { label: "Vegetarian", emoji: "🥬", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  halal: { label: "Halal", emoji: "☪️", color: "bg-teal-100 text-teal-700 border-teal-300" },
  "non-halal": { label: "Non-Halal", emoji: "🍖", color: "bg-orange-100 text-orange-700 border-orange-300" },
};

interface StoreImage { id: string; image_url: string; caption: string | null; }
interface StoreItem { id: string; name: string; description: string | null; price: string | null; ordering_tip: string | null; image_url: string | null; }

const StoreView = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => apiGet<Store>(`/stores/${storeId}`),
    enabled: !!storeId,
  });

  const { data: storeImages } = useQuery({
    queryKey: ["store-images", storeId],
    queryFn: () => apiGet<StoreImage[]>(`/stores/${storeId}/images`),
    enabled: !!storeId,
  });

  const { data: storeItems } = useQuery({
    queryKey: ["store-items", storeId],
    queryFn: () => apiGet<StoreItem[]>(`/stores/${storeId}/items`),
    enabled: !!storeId,
  });

  useEffect(() => { if (storeId) { apiPost(`/stores/${storeId}/visits`, { page_viewed: "store_page" }).catch(() => {}); } }, [storeId]);

  const handleViewOnMap = () => {
    if (store?.latitude && store?.longitude) navigate(`/map?lat=${store.latitude}&lng=${store.longitude}&store=${store.id}`);
    else navigate("/map");
  };

  const nextImage = () => { if (storeImages && storeImages.length > 0) setCurrentImageIndex((prev) => (prev + 1) % storeImages.length); };
  const prevImage = () => { if (storeImages && storeImages.length > 0) setCurrentImageIndex((prev) => (prev - 1 + storeImages.length) % storeImages.length); };

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-32" /><Skeleton className="h-64 w-full rounded-2xl" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-primary text-lg">Store not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
        </div>
      </div>
    );
  }

  const Icon = storeTypeIcons[store.store_type];
  const isPremium = store.subscription_tier === "tier_2";

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground truncate flex-1">{store.store_name}</h1>
          {isPremium && (
            <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 gap-1"><Star className="w-3 h-3 fill-current" />Featured</Badge>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {storeImages && storeImages.length > 0 && (
          <div className="relative">
            <div className="aspect-video rounded-2xl overflow-hidden border-2 border-border">
              <img src={storeImages[currentImageIndex].image_url} alt={store.store_name} className="w-full h-full object-cover" />
            </div>
            {storeImages.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-card/80 rounded-full shadow-lg hover:bg-card transition-colors">
                  <ChevronLeft className="w-5 h-5 text-primary" />
                </button>
                <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-card/80 rounded-full shadow-lg hover:bg-card transition-colors">
                  <ChevronRight className="w-5 h-5 text-primary" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {storeImages.map((_, idx) => (
                    <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={cn("w-2 h-2 rounded-full transition-colors", idx === currentImageIndex ? "bg-foreground" : "bg-foreground/40")} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <Card className="border-border bg-card/80 backdrop-blur">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border-2", storeTypeColors[store.store_type])}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{store.store_name}</h2>
                <Badge variant="outline" className={cn("capitalize text-xs", storeTypeColors[store.store_type])}>{storeTypeLabels[store.store_type]}</Badge>
              </div>
            </div>

            {store.store_type === "food" && store.dietary_options && store.dietary_options.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {store.dietary_options.map((option) => {
                  const dietary = dietaryLabels[option];
                  if (!dietary) return null;
                  return <Badge key={option} variant="outline" className={cn("text-xs", dietary.color)}>{dietary.emoji} {dietary.label}</Badge>;
                })}
              </div>
            )}

            {store.description && <p className="text-muted-foreground leading-relaxed">{store.description}</p>}

            <div className="space-y-2">
              {store.address && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Address</p>
                    <p className="text-sm text-muted-foreground">{store.address}</p>
                    {store.country && <p className="text-xs text-muted-foreground mt-1">{store.country}</p>}
                  </div>
                </div>
              )}
              {store.phone && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Phone</p>
                    <a href={`tel:${store.phone}`} className="text-sm text-primary hover:underline">{store.phone}</a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleViewOnMap} className="flex-1 gap-2 rounded-full"><Navigation className="w-4 h-4" />View on Map</Button>
              {store.website_url && (
                <Button variant="outline" onClick={() => window.open(store.website_url!, "_blank")} className="gap-2 rounded-full"><ExternalLink className="w-4 h-4" />Website</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {storeItems && storeItems.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              {store.store_type === "food" ? "🍽️ Menu" : "📋 What's Offered"}
            </h3>
            <div className="space-y-3">
              {storeItems.map((item) => (
                <Card key={item.id} className="border-border bg-card/80 overflow-hidden">
                  <div className="flex">
                    {item.image_url && (
                      <div className="w-24 h-24 shrink-0"><img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /></div>
                    )}
                    <CardContent className={cn("flex-1 p-3", !item.image_url && "p-4")}>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-foreground">{item.name}</h4>
                        {item.price && <span className="text-sm font-semibold text-primary shrink-0">{item.price}</span>}
                      </div>
                      {item.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                      {item.ordering_tip && <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded-lg inline-block">💡 {item.ordering_tip}</p>}
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
