import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { aiAttractions } from "@/lib/aiClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, MapPin, Star, Sparkles, UtensilsCrossed, Landmark, Wine, 
  Phone, Navigation, X, Leaf, Mountain, Waves, Heart, Globe, 
  ExternalLink, ChevronRight, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// --- Merchant store types ---
const storeTypeIcons = {
  food: UtensilsCrossed,
  attractions: Landmark,
  entertainment: Wine,
};

const storeTypeColors = {
  food: "bg-pink-100 text-pink-700 border-pink-300",
  attractions: "bg-blue-100 text-blue-700 border-blue-300",
  entertainment: "bg-purple-100 text-purple-700 border-purple-300",
};

const storeTypeLabels = {
  food: "Food & Dining",
  attractions: "Attractions",
  entertainment: "Nightlife",
};

interface Store {
  id: string;
  store_name: string;
  address: string | null;
  country: string | null;
  store_type: "food" | "attractions" | "entertainment";
  subscription_tier: "tier_0" | "tier_1" | "tier_2";
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  dietary_options: string[] | null;
}

// --- AI attraction types ---
interface AIAttraction {
  name: string;
  category: string;
  description: string;
  summary: string;
  location: string;
  latitude: number;
  longitude: number;
  source_url: string;
  rating: number;
  price_level: string;
}

const aiCategoryFilters = [
  { value: "Attractions", label: "Attractions", icon: Landmark, color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "Food & Cuisine", label: "Food & Cuisine", icon: UtensilsCrossed, color: "bg-pink-100 text-pink-700 border-pink-300" },
  { value: "Nightlife", label: "Nightlife", icon: Wine, color: "bg-purple-100 text-purple-700 border-purple-300" },
  { value: "Wellness", label: "Wellness", icon: Heart, color: "bg-green-100 text-green-700 border-green-300" },
  { value: "Hiking", label: "Hiking", icon: Mountain, color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "Beaches", label: "Beaches", icon: Waves, color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
];

const getCategoryStyle = (category: string) => {
  const found = aiCategoryFilters.find(c => c.value === category);
  return found || { icon: Globe, color: "bg-gray-100 text-gray-700 border-gray-300" };
};

const dietaryFilters = [
  { value: "vegan", label: "Vegan", emoji: "🌱" },
  { value: "vegetarian", label: "Vegetarian", emoji: "🥬" },
  { value: "halal", label: "Halal", emoji: "☪️" },
  { value: "non-halal", label: "Non-Halal", emoji: "🍖" },
];

type StoreType = "food" | "attractions" | "entertainment";
type SearchTab = "merchants" | "explore";

const storeTypeFiltersList: { type: StoreType; label: string; icon: typeof UtensilsCrossed }[] = [
  { type: "food", label: "Food", icon: UtensilsCrossed },
  { type: "attractions", label: "Attractions", icon: Landmark },
  { type: "entertainment", label: "Nightlife", icon: Wine },
];

const DestinationSearch = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedAttraction, setSelectedAttraction] = useState<AIAttraction | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<StoreType | null>(null);
  const [activeDietaryFilters, setActiveDietaryFilters] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<SearchTab>("explore");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Merchant store query
  const { data: stores, isLoading: storesLoading, isFetched: storesFetched } = useQuery({
    queryKey: ["destination-stores", activeSearch],
    queryFn: async () => {
      if (!activeSearch.trim()) return null;
      const { data, error } = await supabase
        .from("stores")
        .select("id, store_name, address, country, store_type, subscription_tier, phone, latitude, longitude, dietary_options")
        .ilike("country", `%${activeSearch}%`)
        .order("subscription_tier", { ascending: false });
      if (error) throw error;
      return data as Store[];
    },
    enabled: !!activeSearch.trim(),
  });

  // AI attractions query
  const { data: aiAttractions, isLoading: aiLoading, isFetched: aiFetched } = useQuery({
    queryKey: ["ai-attractions", activeSearch, activeCategoryFilter],
    queryFn: async () => {
      if (!activeSearch.trim()) return null;
      const data = await aiAttractions(activeSearch, activeCategoryFilter || undefined);
      return (data?.attractions as AIAttraction[]) || [];
    },
    enabled: !!activeSearch.trim() && activeTab === "explore",
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    setActiveSearch(q);
    setActiveCategoryFilter(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleViewOnMap = (store: Store) => {
    if (store.latitude && store.longitude) {
      navigate(`/map?lat=${store.latitude}&lng=${store.longitude}&store=${store.id}`);
    } else {
      navigate("/map");
    }
  };

  const handleViewAttractionOnMap = (attraction: AIAttraction) => {
    if (attraction.latitude && attraction.longitude) {
      navigate(`/map?lat=${attraction.latitude}&lng=${attraction.longitude}`);
    }
  };

  const toggleTypeFilter = (type: StoreType) => {
    setActiveTypeFilter(activeTypeFilter === type ? null : type);
    if (type !== "food") setActiveDietaryFilters([]);
  };

  const toggleDietaryFilter = (value: string) => {
    setActiveDietaryFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  // Filter merchant stores
  const filteredStores = stores?.filter((s) => {
    if (activeTypeFilter && s.store_type !== activeTypeFilter) return false;
    if (activeDietaryFilters.length > 0) {
      if (s.store_type !== "food") return false;
      if (!s.dietary_options) return false;
      return activeDietaryFilters.every((filter) => s.dietary_options?.includes(filter));
    }
    return true;
  });

  const premiumStores = filteredStores?.filter((s) => s.subscription_tier === "tier_2") || [];
  const regularStores = filteredStores?.filter((s) => s.subscription_tier !== "tier_2") || [];
  const hasStoreResults = (filteredStores?.length || 0) > 0;
  const hasNoFilteredResults = stores && stores.length > 0 && filteredStores?.length === 0;
  const showDietaryFilters = activeTypeFilter === "food" || (!activeTypeFilter && stores?.some((s) => s.store_type === "food"));

  // Filter AI attractions
  const filteredAttractions = activeCategoryFilter
    ? aiAttractions?.filter(a => a.category === activeCategoryFilter)
    : aiAttractions;

  const StoreCard = ({ store, isPremium = false }: { store: Store; isPremium?: boolean }) => {
    const Icon = storeTypeIcons[store.store_type];
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        onClick={() => navigate(`/store/${store.id}`)}
        className={cn(
          "relative rounded-2xl border-2 bg-card transition-all hover:shadow-lg cursor-pointer overflow-hidden",
          isPremium 
            ? "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-500 shadow-md shadow-amber-100" 
            : "border-primary/30 hover:border-primary/50"
        )}
      >
        {isPremium && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-b from-amber-400 to-orange-400 flex flex-col items-center justify-center gap-1">
            <Star className="w-4 h-4 text-white fill-white" />
            <span className="text-[9px] font-bold text-white uppercase tracking-wide" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              Travela Recommends
            </span>
          </div>
        )}
        <div className={cn("p-4", isPremium && "pl-12")}>
          <div className="flex items-start gap-3">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border-2 shrink-0", storeTypeColors[store.store_type])}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-foreground truncate">{store.store_name}</h4>
                {isPremium && (
                  <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 text-xs gap-1 shrink-0">
                    <Star className="w-3 h-3 fill-current" />
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{store.address || "Address not available"}</span>
              </p>
              <Badge variant="outline" className={cn("mt-2 text-xs capitalize", storeTypeColors[store.store_type])}>
                {storeTypeLabels[store.store_type]}
              </Badge>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const AttractionCard = ({ attraction }: { attraction: AIAttraction }) => {
    const catStyle = getCategoryStyle(attraction.category);
    const CatIcon = catStyle.icon;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        onClick={() => setSelectedAttraction(attraction)}
        className="rounded-2xl border-2 border-primary/30 bg-card hover:border-primary/50 transition-all hover:shadow-lg cursor-pointer p-4"
      >
        <div className="flex items-start gap-3">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border-2 shrink-0", catStyle.color)}>
            <CatIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-foreground truncate">{attraction.name}</h4>
              {attraction.rating && (
                <span className="text-xs text-amber-600 flex items-center gap-0.5 shrink-0">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {attraction.rating}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{attraction.location}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{attraction.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={cn("text-xs", catStyle.color)}>
                {attraction.category}
              </Badge>
              {attraction.price_level && (
                <Badge variant="outline" className="text-xs">
                  {attraction.price_level}
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <Card className="cutesy-border bg-card/95 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Explore Destinations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter a city or country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 border-2 border-primary/50 rounded-full h-10"
              />
            </div>
            <Button onClick={handleSearch} className="rounded-full px-5 bg-primary hover:bg-primary/90">
              Search
            </Button>
          </div>

          {/* Tabs: Explore / Local Merchants */}
          {activeSearch && (
            <div className="flex gap-1 bg-muted/50 p-1 rounded-full">
              <button
                onClick={() => setActiveTab("explore")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === "explore" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe className="w-4 h-4" />
                Explore
              </button>
              <button
                onClick={() => setActiveTab("merchants")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === "merchants" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Landmark className="w-4 h-4" />
                Local Spots
                {stores && stores.length > 0 && (
                  <span className="text-xs bg-white/20 px-1.5 rounded-full">{stores.length}</span>
                )}
              </button>
            </div>
          )}

          {/* --- EXPLORE TAB --- */}
          {activeSearch && activeTab === "explore" && (
            <>
              {/* Category Filters */}
              <div className="flex gap-2 flex-wrap">
                {aiCategoryFilters.map((cat) => {
                  const CatIcon = cat.icon;
                  const isActive = activeCategoryFilter === cat.value;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setActiveCategoryFilter(isActive ? null : cat.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border-2",
                        isActive
                          ? cn(cat.color, "ring-2 ring-offset-1 ring-primary/50")
                          : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                      )}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
                {activeCategoryFilter && (
                  <button
                    onClick={() => setActiveCategoryFilter(null)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {/* AI Results */}
              <AnimatePresence mode="wait">
                {aiLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                    <Loader2 className="w-6 h-6 text-primary mx-auto animate-spin" />
                    <p className="text-sm text-muted-foreground mt-2">Discovering places in {activeSearch}...</p>
                  </motion.div>
                )}

                {!aiLoading && aiFetched && (!filteredAttractions || filteredAttractions.length === 0) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                    <Globe className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">No attractions found for "{activeSearch}"</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Try a different country or category</p>
                  </motion.div>
                )}

                {!aiLoading && filteredAttractions && filteredAttractions.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">
                        AI-powered results for {activeSearch}
                      </span>
                    </div>
                    {filteredAttractions.map((attraction, i) => (
                      <AttractionCard key={`${attraction.name}-${i}`} attraction={attraction} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* --- MERCHANTS TAB --- */}
          {activeSearch && activeTab === "merchants" && (
            <>
              {/* Store Type Filters */}
              {stores && stores.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {storeTypeFiltersList.map((filter) => {
                    const Icon = filter.icon;
                    const isActive = activeTypeFilter === filter.type;
                    const count = stores.filter((s) => s.store_type === filter.type).length;
                    return (
                      <button
                        key={filter.type}
                        onClick={() => toggleTypeFilter(filter.type)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2",
                          isActive ? cn(storeTypeColors[filter.type], "ring-2 ring-offset-1 ring-primary/50") : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {filter.label}
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", isActive ? "bg-white/50" : "bg-background")}>{count}</span>
                      </button>
                    );
                  })}
                  {activeTypeFilter && (
                    <button onClick={() => setActiveTypeFilter(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
              )}

              {/* Dietary Filters */}
              {stores && stores.length > 0 && showDietaryFilters && (
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Leaf className="w-3 h-3" /> Dietary:
                  </span>
                  {dietaryFilters.map((filter) => {
                    const isActive = activeDietaryFilters.includes(filter.value);
                    return (
                      <button
                        key={filter.value}
                        onClick={() => toggleDietaryFilter(filter.value)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                          isActive ? "bg-green-100 text-green-700 border-green-300 ring-1 ring-green-400/50" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                      >
                        <span>{filter.emoji}</span> {filter.label}
                      </button>
                    );
                  })}
                  {activeDietaryFilters.length > 0 && (
                    <button onClick={() => setActiveDietaryFilters([])} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
              )}

              {/* Store Results */}
              <AnimatePresence mode="wait">
                {storesLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                    <div className="inline-block w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground mt-2">Searching local spots...</p>
                  </motion.div>
                )}

                {!storesLoading && storesFetched && stores?.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                    <MapPin className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">No local spots found in "{activeSearch}"</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Try the Explore tab for AI recommendations</p>
                  </motion.div>
                )}

                {!storesLoading && hasNoFilteredResults && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                    <MapPin className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">No {activeTypeFilter} places found</p>
                    <button onClick={() => setActiveTypeFilter(null)} className="text-sm text-primary hover:underline mt-1">
                      Clear filter to see all results
                    </button>
                  </motion.div>
                )}

                {!storesLoading && hasStoreResults && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    {premiumStores.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-500" />
                          <h3 className="font-bold text-foreground">Travela Recommends</h3>
                          <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 text-xs">Top 3</Badge>
                        </div>
                        <div className="space-y-3">
                          {premiumStores.slice(0, 3).map((store) => (
                            <StoreCard key={store.id} store={store} isPremium />
                          ))}
                        </div>
                      </div>
                    )}
                    {regularStores.length > 0 && (
                      <div className="space-y-3">
                        {premiumStores.length > 0 && <h3 className="font-bold text-foreground">More Places</h3>}
                        <div className="space-y-3">
                          {regularStores.map((store) => (
                            <StoreCard key={store.id} store={store} />
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </CardContent>
      </Card>

      {/* Store Detail Dialog */}
      <Dialog open={!!selectedStore} onOpenChange={() => setSelectedStore(null)}>
        <DialogContent className="cutesy-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {selectedStore && (
                <>
                  {(() => {
                    const Icon = storeTypeIcons[selectedStore.store_type];
                    return (
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border-2 shrink-0", storeTypeColors[selectedStore.store_type])}>
                        <Icon className="w-5 h-5" />
                      </div>
                    );
                  })()}
                  <span>{selectedStore.store_name}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedStore && (
            <div className="space-y-4">
              {selectedStore.subscription_tier === "tier_2" && (
                <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 gap-1">
                  <Star className="w-3 h-3 fill-current" /> Travela Recommended
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("capitalize", storeTypeColors[selectedStore.store_type])}>
                  {storeTypeLabels[selectedStore.store_type]}
                </Badge>
              </div>
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Address</p>
                  <p className="text-sm text-muted-foreground">{selectedStore.address || "Address not available"}</p>
                </div>
              </div>
              {selectedStore.phone && (
                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl">
                  <Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Phone</p>
                    <a href={`tel:${selectedStore.phone}`} className="text-sm text-primary hover:underline">{selectedStore.phone}</a>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button onClick={() => handleViewOnMap(selectedStore)} className="flex-1 gap-2 rounded-full">
                  <Navigation className="w-4 h-4" /> View on Map
                </Button>
                <Button variant="outline" onClick={() => setSelectedStore(null)} className="rounded-full px-6">Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Attraction Detail Dialog */}
      <Dialog open={!!selectedAttraction} onOpenChange={() => setSelectedAttraction(null)}>
        <DialogContent className="cutesy-border max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {selectedAttraction && (
                <>
                  {(() => {
                    const catStyle = getCategoryStyle(selectedAttraction.category);
                    const CatIcon = catStyle.icon;
                    return (
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border-2 shrink-0", catStyle.color)}>
                        <CatIcon className="w-5 h-5" />
                      </div>
                    );
                  })()}
                  <span>{selectedAttraction.name}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedAttraction && (
            <div className="space-y-4">
              {/* Category & Rating */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs", getCategoryStyle(selectedAttraction.category).color)}>
                  {selectedAttraction.category}
                </Badge>
                {selectedAttraction.rating && (
                  <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {selectedAttraction.rating}
                  </Badge>
                )}
                {selectedAttraction.price_level && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {selectedAttraction.price_level}
                  </Badge>
                )}
              </div>

              {/* Location */}
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Location</p>
                  <p className="text-sm text-muted-foreground">{selectedAttraction.location}</p>
                </div>
              </div>

              {/* AI Summary */}
              <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="w-4 h-4" />
                  AI Summary
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {selectedAttraction.summary}
                </p>
              </div>

              {/* Source Link */}
              {selectedAttraction.source_url && (
                <a
                  href={selectedAttraction.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl text-sm text-primary hover:bg-secondary transition-colors"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span className="truncate">{selectedAttraction.source_url}</span>
                </a>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                {selectedAttraction.latitude && selectedAttraction.longitude && (
                  <Button onClick={() => handleViewAttractionOnMap(selectedAttraction)} className="flex-1 gap-2 rounded-full">
                    <Navigation className="w-4 h-4" /> View on Map
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedAttraction(null)} className="rounded-full px-6">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DestinationSearch;
