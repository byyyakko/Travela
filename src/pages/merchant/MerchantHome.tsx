import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Eye } from "lucide-react";
import { format } from "date-fns";

interface StoreContext {
  store: {
    id: string;
    store_name: string;
    store_type: string;
    subscription_tier: string;
  } | null;
}

const MerchantHome = () => {
  const { store } = useOutletContext<StoreContext>();
  // Simulated stats for showcase
  const stats = {
    totalVisits: 1247,
    todayVisits: 38,
    weekVisits: 305,
  };
  const loading = false;

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "tier_2":
        return { label: "Premium", color: "bg-gradient-to-r from-amber-400 to-orange-500 text-white" };
      case "tier_1":
        return { label: "Pro", color: "bg-gradient-to-r from-pink-400 to-purple-500 text-white" };
      default:
        return { label: "Free", color: "bg-gray-100 text-gray-600" };
    }
  };

  const tierInfo = getTierBadge(store?.subscription_tier || "tier_0");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-pink-700">
            Welcome back! 👋
          </h1>
          <p className="text-pink-500 mt-1">
            Here's how {store?.store_name} is performing
          </p>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${tierInfo.color}`}>
          {tierInfo.label} Plan
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-pink-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-pink-600">
              Today's Visitors
            </CardTitle>
            <Eye className="w-5 h-5 text-pink-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-700">{stats.todayVisits}</div>
            <p className="text-xs text-pink-400 mt-1">
              {format(new Date(), "MMMM d, yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-pink-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-pink-600">
              This Week
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-pink-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-700">{stats.weekVisits}</div>
            <p className="text-xs text-pink-400 mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card className="border-pink-200 bg-white/80 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-pink-600">
              Total Visitors
            </CardTitle>
            <Users className="w-5 h-5 text-pink-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-700">{stats.totalVisits}</div>
            <p className="text-xs text-pink-400 mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Tips */}
      <Card className="border-pink-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-pink-700">💡 Quick Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-lg">
            <span className="text-2xl">📈</span>
            <div>
              <p className="font-medium text-pink-700">Boost your visibility</p>
              <p className="text-sm text-pink-500">
                Upgrade to Pro or Premium to unlock detailed insights and get featured in recommendations!
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-lg">
            <span className="text-2xl">🌍</span>
            <div>
              <p className="font-medium text-pink-700">Attract travelers</p>
              <p className="text-sm text-pink-500">
                Keep your store profile updated to help tourists discover you!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantHome;
