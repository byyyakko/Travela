import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Sparkles, MessageCircle, Map, MapPin, Globe, Wifi, Languages, Heart, Users, BadgePercent, PartyPopper } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import mascotCutesy from "@/assets/mascot-cutesy.png";

type SubscriptionTier = "tier_0" | "tier_1" | "tier_2";

interface TierInfo {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  price: string;
  priceNote: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  features: { text: string; icon: React.ElementType }[];
  highlighted?: boolean;
}

const tiers: TierInfo[] = [
  {
    id: "tier_0",
    name: "Free Explorer",
    tagline: "Discover authentically",
    price: "Free",
    priceNote: "Forever free",
    icon: Globe,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    features: [
      { text: "Browse locals & hawkers", icon: Users },
      { text: "Chat with locals freely", icon: MessageCircle },
      { text: "See local favorites", icon: Heart },
      { text: "Common phrases lookup", icon: Languages },
      { text: "Basic maps & discovery", icon: Map },
    ],
  },
  {
    id: "tier_1",
    name: "Travela Plus",
    tagline: "Travel with confidence",
    price: "$5",
    priceNote: "per month",
    icon: Star,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    highlighted: true,
    features: [
      { text: "Everything in Free Explorer", icon: Check },
      { text: "No platform fee on experiences you host", icon: BadgePercent },
      { text: "Exclusive last-minute experience deals", icon: PartyPopper },
    ],
  },
];

const floatAnimation = {
  y: [0, -8, 0],
  transition: {
    duration: 2.5,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

const Subscription = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);

  const { data: currentTier, isLoading } = useQuery({
    queryKey: ["userSubscription", user?.id],
    queryFn: async () => {
      if (!user?.id) return "tier_0";
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return (data?.subscription_tier as SubscriptionTier) || "tier_0";
    },
    enabled: !!user?.id,
  });

  const upgradeMutation = useMutation({
    mutationFn: async (newTier: SubscriptionTier) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_tier: newTier })
        .eq("user_id", user.id);
      
      if (error) throw error;
      return newTier;
    },
    onSuccess: (newTier) => {
      queryClient.invalidateQueries({ queryKey: ["userSubscription", user?.id] });
      const tierName = tiers.find(t => t.id === newTier)?.name || newTier;
      toast({
        title: "Subscription Updated! 🎉",
        description: `You're now on ${tierName}`,
      });
      setSelectedTier(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSelectTier = (tierId: SubscriptionTier) => {
    if (tierId === currentTier) return;
    setSelectedTier(tierId);
  };

  const handleConfirmUpgrade = () => {
    if (selectedTier) {
      upgradeMutation.mutate(selectedTier);
    }
  };

  const getTierIndex = (tierId: SubscriptionTier) => tiers.findIndex(t => t.id === tierId);

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-primary">Subscription</h1>
          <p className="text-sm text-muted-foreground">Choose your travel style</p>
        </div>

        {/* Mascot Banner */}
        <Card className="p-5 cutesy-grid-bg cutesy-border bg-card/95 relative overflow-hidden">
          <div className="flex items-center gap-4">
            <motion.img
              src={mascotCutesy}
              alt="Travela mascot"
              className="w-20 h-20 object-contain drop-shadow-md mix-blend-multiply"
              animate={floatAnimation}
            />
            <div>
              <h2 className="text-lg font-bold text-primary mb-1">
                Enhance your journey! ✨
              </h2>
              <p className="text-sm text-muted-foreground">
                Premium means clarity & confidence — never gated connections.
                Messaging locals is <span className="font-semibold text-primary">always free</span>.
              </p>
            </div>
          </div>
        </Card>

        {/* Current Plan Badge */}
        {currentTier && !isLoading && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current plan:</span>
            <Badge variant="secondary" className="font-semibold">
              {tiers.find(t => t.id === currentTier)?.name || "Free Explorer"}
            </Badge>
          </div>
        )}

        {/* Tier Cards */}
        <div className="space-y-4">
          {tiers.map((tier, index) => {
            const isCurrentPlan = tier.id === currentTier;
            const isDowngrade = getTierIndex(tier.id) < getTierIndex(currentTier || "tier_0");
            const isSelected = selectedTier === tier.id;
            const TierIcon = tier.icon;

            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`p-5 cutesy-border transition-all cursor-pointer ${
                    tier.highlighted ? "ring-2 ring-primary ring-offset-2" : ""
                  } ${isSelected ? "ring-2 ring-primary" : ""} ${
                    isCurrentPlan ? "bg-secondary/50" : "bg-card/95"
                  }`}
                  onClick={() => handleSelectTier(tier.id)}
                >
                  {/* Tier Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full ${tier.bgColor} ${tier.borderColor} border-2 flex items-center justify-center`}>
                        <TierIcon className={`w-6 h-6 ${tier.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{tier.name}</h3>
                          {tier.highlighted && (
                            <Badge className="bg-primary text-primary-foreground text-xs">
                              Popular
                            </Badge>
                          )}
                          {isCurrentPlan && (
                            <Badge variant="outline" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{tier.tagline}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${tier.color}`}>{tier.price}</p>
                      <p className="text-xs text-muted-foreground">{tier.priceNote}</p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    {tier.features.map((feature, i) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <FeatureIcon className={`w-4 h-4 ${tier.color} flex-shrink-0`} />
                          <span className="text-foreground">{feature.text}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Button */}
                  <div className="mt-4">
                    {isCurrentPlan ? (
                      <Button disabled className="w-full" variant="secondary">
                        Current Plan
                      </Button>
                    ) : isSelected ? (
                      <Button
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmUpgrade();
                        }}
                        disabled={upgradeMutation.isPending}
                      >
                        {upgradeMutation.isPending ? "Processing..." : isDowngrade ? "Downgrade" : "Upgrade Now"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTier(tier.id);
                        }}
                      >
                        {isDowngrade ? "Select to Downgrade" : "Select Plan"}
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Note */}
        <Card className="p-4 cutesy-border bg-secondary/30">
          <p className="text-xs text-muted-foreground text-center">
            🔒 <strong>Our Promise:</strong> Messaging locals, viewing hawkers, and basic discovery are{" "}
            <span className="text-primary font-semibold">always free</span>. Premium enhances your experience
            without gating human connection.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Subscription;
