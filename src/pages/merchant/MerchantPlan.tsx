import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, Sparkles, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

interface StoreContext {
  store: {
    id: string;
    store_name: string;
    store_type: string;
    subscription_tier: string;
  } | null;
}

const plans = [
  {
    tier: "tier_0",
    name: "Free",
    price: 0,
    icon: Zap,
    description: "Get started with basic analytics",
    features: ["View total visitor count", "Today's visitor count", "Weekly visitor count", "Basic store profile"],
    lockedFeatures: ["Visitor country insights", "Traffic trends & charts", "Peak time analysis", "Recommended listing"],
    buttonText: "Current Plan",
    buttonVariant: "outline" as const,
  },
  {
    tier: "tier_1",
    name: "Pro",
    price: 40,
    icon: Star,
    description: "Unlock detailed insights",
    popular: true,
    features: ["Everything in Free", "Visitor country origins", "Monthly footfall charts", "Peak time analysis", "Favorite items tracking"],
    lockedFeatures: ["Recommended by Travela listing"],
    buttonText: "Upgrade to Pro",
    buttonVariant: "default" as const,
  },
  {
    tier: "tier_2",
    name: "Premium",
    price: 100,
    icon: Crown,
    description: "Maximum visibility & insights",
    features: ["Everything in Pro", "Featured in 'Recommended by Travela'", "Priority search placement", "Premium badge on profile", "Priority support"],
    lockedFeatures: [],
    buttonText: "Upgrade to Premium",
    buttonVariant: "default" as const,
  },
];

const MerchantPlan = () => {
  const { store } = useOutletContext<StoreContext>();
  const currentTier = store?.subscription_tier || "tier_0";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async (tier: string) => {
    if (!store?.id) return;
    setUpgrading(true);
    try {
      const { error } = await supabase.from("stores").update({ subscription_tier: tier as "tier_0" | "tier_1" | "tier_2" }).eq("id", store.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["merchant-store"] });
      const planName = plans.find(p => p.tier === tier)?.name || tier;
      toast({ title: "Plan Updated! 🎉", description: `You're now on the ${planName} plan.` });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to update plan. Please try again.", variant: "destructive" });
    } finally {
      setUpgrading(false);
    }
  };

  const getTierIndex = (tier: string) => plans.findIndex((p) => p.tier === tier);
  const currentTierIndex = getTierIndex(currentTier);

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">Unlock powerful insights and reach more travelers with our premium plans</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, index) => {
          const isCurrentPlan = currentTier === plan.tier;
          const isPastPlan = index < currentTierIndex;
          const isFuturePlan = index > currentTierIndex;

          return (
            <Card
              key={plan.tier}
              className={cn(
                "border-2 relative overflow-hidden transition-all",
                isCurrentPlan ? "border-primary bg-primary/5" : "border-border bg-card/80",
                plan.popular && "ring-2 ring-primary ring-offset-2"
              )}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-lg">
                  Most Popular
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-br-lg">
                  Current Plan
                </div>
              )}

              <CardHeader className="text-center pt-8">
                <div className={cn("w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3", isCurrentPlan ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                  <plan.icon className="w-7 h-7" />
                </div>
                <CardTitle className="text-xl text-foreground">{plan.name}</CardTitle>
                <div className="mt-2">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-foreground">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
                {plan.lockedFeatures.length > 0 && (
                  <div className="space-y-2 opacity-50">
                    {plan.lockedFeatures.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <span className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5">—</span>
                        <span className="text-sm text-muted-foreground line-through">{feature}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className={cn(
                    "w-full mt-4",
                    isCurrentPlan ? "bg-muted text-muted-foreground hover:bg-muted cursor-default"
                      : isPastPlan ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : plan.tier === "tier_2" ? "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white"
                      : ""
                  )}
                  onClick={() => isFuturePlan && handleUpgrade(plan.tier)}
                  disabled={!isFuturePlan || upgrading}
                >
                  {isCurrentPlan ? (<><Sparkles className="w-4 h-4 mr-2" />Current Plan</>) : isPastPlan ? "Included" : plan.buttonText}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border bg-card/80 backdrop-blur mt-8">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground">Can I cancel anytime?</h3>
            <p className="text-sm text-muted-foreground">Yes! You can cancel your subscription at any time. Your benefits will continue until the end of your billing period.</p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">What is "Recommended by Travela"?</h3>
            <p className="text-sm text-muted-foreground">Premium members get featured in our curated recommendations when travelers search for stores in your area, giving you maximum visibility.</p>
          </div>
          <div>
            <h3 className="font-medium text-foreground">How are visitor insights collected?</h3>
            <p className="text-sm text-muted-foreground">We track anonymous profile views from users browsing your store. Country data comes from users who have set their travel destination.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantPlan;
