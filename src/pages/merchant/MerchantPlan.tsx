import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, Sparkles, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

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
    features: [
      "View total visitor count",
      "Today's visitor count",
      "Weekly visitor count",
      "Basic store profile",
    ],
    lockedFeatures: [
      "Visitor country insights",
      "Traffic trends & charts",
      "Peak time analysis",
      "Recommended listing",
    ],
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
    features: [
      "Everything in Free",
      "Visitor country origins",
      "Monthly footfall charts",
      "Peak time analysis",
      "Favorite items tracking",
    ],
    lockedFeatures: [
      "Recommended by Travela listing",
    ],
    buttonText: "Upgrade to Pro",
    buttonVariant: "default" as const,
  },
  {
    tier: "tier_2",
    name: "Premium",
    price: 100,
    icon: Crown,
    description: "Maximum visibility & insights",
    features: [
      "Everything in Pro",
      "Featured in 'Recommended by Travela'",
      "Priority search placement",
      "Premium badge on profile",
      "Priority support",
    ],
    lockedFeatures: [],
    buttonText: "Upgrade to Premium",
    buttonVariant: "default" as const,
  },
];

const MerchantPlan = () => {
  const { store } = useOutletContext<StoreContext>();
  const currentTier = store?.subscription_tier || "tier_0";

  const handleUpgrade = (tier: string) => {
    // TODO: Integrate with payment system
    console.log("Upgrading to:", tier);
    alert(`Payment integration coming soon! You selected the ${tier === "tier_1" ? "Pro" : "Premium"} plan.`);
  };

  const getTierIndex = (tier: string) => {
    return plans.findIndex((p) => p.tier === tier);
  };

  const currentTierIndex = getTierIndex(currentTier);

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-pink-700">Choose Your Plan</h1>
        <p className="text-pink-500 mt-2">
          Unlock powerful insights and reach more travelers with our premium plans
        </p>
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
                isCurrentPlan
                  ? "border-pink-400 bg-pink-50/50"
                  : "border-pink-200 bg-white/80",
                plan.popular && "ring-2 ring-pink-400 ring-offset-2"
              )}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                  Most Popular
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute top-0 left-0 bg-pink-500 text-white text-xs font-medium px-3 py-1 rounded-br-lg">
                  Current Plan
                </div>
              )}

              <CardHeader className="text-center pt-8">
                <div
                  className={cn(
                    "w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3",
                    isCurrentPlan
                      ? "bg-pink-500 text-white"
                      : "bg-pink-100 text-pink-500"
                  )}
                >
                  <plan.icon className="w-7 h-7" />
                </div>
                <CardTitle className="text-xl text-pink-700">{plan.name}</CardTitle>
                <div className="mt-2">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-pink-700">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-pink-700">${plan.price}</span>
                      <span className="text-pink-400">/month</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-pink-500 mt-2">{plan.description}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Included Features */}
                <div className="space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-pink-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Locked Features */}
                {plan.lockedFeatures.length > 0 && (
                  <div className="space-y-2 opacity-50">
                    {plan.lockedFeatures.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <span className="w-5 h-5 text-pink-300 shrink-0 mt-0.5">—</span>
                        <span className="text-sm text-pink-400 line-through">{feature}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Button */}
                <Button
                  className={cn(
                    "w-full mt-4",
                    isCurrentPlan
                      ? "bg-pink-100 text-pink-600 hover:bg-pink-200 cursor-default"
                      : isPastPlan
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : plan.tier === "tier_2"
                      ? "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white"
                      : "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                  )}
                  onClick={() => isFuturePlan && handleUpgrade(plan.tier)}
                  disabled={!isFuturePlan}
                >
                  {isCurrentPlan ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Current Plan
                    </>
                  ) : isPastPlan ? (
                    "Included"
                  ) : (
                    plan.buttonText
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ or additional info */}
      <Card className="border-pink-200 bg-white/80 backdrop-blur mt-8">
        <CardHeader>
          <CardTitle className="text-lg text-pink-700">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium text-pink-700">Can I cancel anytime?</h3>
            <p className="text-sm text-pink-500">
              Yes! You can cancel your subscription at any time. Your benefits will continue until the end of your billing period.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-pink-700">What is "Recommended by Travela"?</h3>
            <p className="text-sm text-pink-500">
              Premium members get featured in our curated recommendations when travelers search for stores in your area, giving you maximum visibility.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-pink-700">How are visitor insights collected?</h3>
            <p className="text-sm text-pink-500">
              We track anonymous profile views from users browsing your store. Country data comes from users who have set their travel destination.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantPlan;
