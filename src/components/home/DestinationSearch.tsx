import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Star, Sparkles, UtensilsCrossed, Landmark, Gamepad2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const storeTypeIcons = {
  food: UtensilsCrossed,
  attractions: Landmark,
  entertainment: Gamepad2,
};

const storeTypeColors = {
  food: "bg-pink-100 text-pink-700 border-pink-300",
  attractions: "bg-blue-100 text-blue-700 border-blue-300",
  entertainment: "bg-purple-100 text-purple-700 border-purple-300",
};

interface Store {
  id: string;
  store_name: string;
  address: string | null;
  store_type: "food" | "attractions" | "entertainment";
  subscription_tier: "tier_0" | "tier_1" | "tier_2";
  phone: string | null;
}

const DestinationSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data: stores, isLoading, isFetched } = useQuery({
    queryKey: ["destination-stores", activeSearch],
    queryFn: async () => {
      if (!activeSearch.trim()) return null;

      const { data, error } = await supabase
        .from("stores")
        .select("id, store_name, address, store_type, subscription_tier, phone")
        .ilike("address", `%${activeSearch}%`)
        .order("subscription_tier", { ascending: false });

      if (error) throw error;
      return data as Store[];
    },
    enabled: !!activeSearch.trim(),
  });

  const handleSearch = () => {
    setActiveSearch(searchQuery.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Separate premium (tier_2) stores from regular stores
  const premiumStores = stores?.filter((s) => s.subscription_tier === "tier_2") || [];
  const regularStores = stores?.filter((s) => s.subscription_tier !== "tier_2") || [];

  const StoreCard = ({ store, isPremium = false }: { store: Store; isPremium?: boolean }) => {
    const Icon = storeTypeIcons[store.store_type];
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "p-4 rounded-2xl border-2 bg-card transition-all hover:shadow-md",
          isPremium 
            ? "border-amber-400 bg-gradient-to-br from-amber-50/80 to-orange-50/50" 
            : "border-primary/30"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center border-2 shrink-0",
            storeTypeColors[store.store_type]
          )}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-foreground truncate">{store.store_name}</h4>
              {isPremium && (
                <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 text-xs gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{store.address || "Address not available"}</span>
            </p>
            <Badge 
              variant="outline" 
              className={cn("mt-2 text-xs capitalize", storeTypeColors[store.store_type])}
            >
              {store.store_type}
            </Badge>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
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
          <Button 
            onClick={handleSearch}
            className="rounded-full px-5 bg-primary hover:bg-primary/90"
          >
            Search
          </Button>
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="inline-block w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground mt-2">Searching...</p>
            </motion.div>
          )}

          {!isLoading && isFetched && activeSearch && stores?.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <MapPin className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">No attractions found in "{activeSearch}"</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Try a different location</p>
            </motion.div>
          )}

          {!isLoading && stores && stores.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Travela Recommends - Premium Section */}
              {premiumStores.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-foreground">Travela Recommends</h3>
                    <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white border-0 text-xs">
                      Top 3
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {premiumStores.slice(0, 3).map((store) => (
                      <StoreCard key={store.id} store={store} isPremium />
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Stores */}
              {regularStores.length > 0 && (
                <div className="space-y-3">
                  {premiumStores.length > 0 && (
                    <h3 className="font-bold text-foreground">More Places</h3>
                  )}
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
      </CardContent>
    </Card>
  );
};

export default DestinationSearch;
