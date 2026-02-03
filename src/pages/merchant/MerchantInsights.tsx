import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Globe, TrendingUp, Calendar, Star, MapPin } from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface StoreContext {
  store: {
    id: string;
    store_name: string;
    store_type: string;
    subscription_tier: string;
  } | null;
}

const COLORS = ["#f472b6", "#c084fc", "#60a5fa", "#34d399", "#fbbf24"];

const MerchantInsights = () => {
  const { store } = useOutletContext<StoreContext>();
  const navigate = useNavigate();
  const [weeklyData, setWeeklyData] = useState<{ day: string; visits: number }[]>([]);
  const [countryData, setCountryData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const isTier0 = store?.subscription_tier === "tier_0";
  const isTier1OrAbove = store?.subscription_tier === "tier_1" || store?.subscription_tier === "tier_2";

  useEffect(() => {
    const fetchInsights = async () => {
      if (!store?.id || isTier0) {
        setLoading(false);
        return;
      }

      const weekAgo = startOfDay(subDays(new Date(), 6));
      const today = new Date();

      // Fetch visits for the past week
      const { data: visits } = await supabase
        .from("store_visits")
        .select("visited_at, visitor_country")
        .eq("store_id", store.id)
        .gte("visited_at", weekAgo.toISOString());

      // Process weekly data
      const days = eachDayOfInterval({ start: weekAgo, end: today });
      const dailyVisits = days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const count = visits?.filter(
          (v) => format(new Date(v.visited_at), "yyyy-MM-dd") === dayStr
        ).length || 0;
        return {
          day: format(day, "EEE"),
          visits: count,
        };
      });
      setWeeklyData(dailyVisits);

      // Process country data
      const countryCounts: Record<string, number> = {};
      visits?.forEach((v) => {
        const country = v.visitor_country || "Unknown";
        countryCounts[country] = (countryCounts[country] || 0) + 1;
      });
      const countryArray = Object.entries(countryCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setCountryData(countryArray);

      setLoading(false);
    };

    fetchInsights();
  }, [store?.id, isTier0]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Tier 0 - Locked state
  if (isTier0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-pink-700">Insights</h1>
          <p className="text-pink-500 mt-1">Detailed analytics for your store</p>
        </div>

        <Card className="border-pink-200 bg-white/80 backdrop-blur">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-pink-100 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-pink-400" />
            </div>
            <h2 className="text-xl font-semibold text-pink-700 mb-2">
              Unlock Detailed Insights
            </h2>
            <p className="text-pink-500 max-w-md mx-auto mb-6">
              Upgrade to Pro to see where your visitors come from, track monthly footfall trends, 
              and discover your most popular offerings.
            </p>
            <Button
              onClick={() => navigate("/merchant-dashboard/plan")}
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
            >
              Upgrade to Pro - $40/month
            </Button>
          </CardContent>
        </Card>

        {/* Preview of locked features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: Globe, title: "Visitor Origins", desc: "See which countries your visitors come from" },
            { icon: TrendingUp, title: "Footfall Trends", desc: "Track daily and monthly visitor patterns" },
            { icon: Calendar, title: "Peak Times", desc: "Discover your busiest days and hours" },
            { icon: Star, title: "Popular Items", desc: "Find out what customers love most" },
          ].map((feature, i) => (
            <Card key={i} className="border-pink-200 bg-white/40 backdrop-blur opacity-60">
              <CardContent className="py-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-pink-400" />
                </div>
                <div>
                  <h3 className="font-medium text-pink-700">{feature.title}</h3>
                  <p className="text-sm text-pink-400">{feature.desc}</p>
                </div>
                <Lock className="w-5 h-5 text-pink-300 ml-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Tier 1+ - Full insights
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pink-700">Insights</h1>
        <p className="text-pink-500 mt-1">Detailed analytics for {store?.store_name}</p>
      </div>

      {/* Weekly Traffic Chart */}
      <Card className="border-pink-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-pink-700 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Weekly Traffic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="day" stroke="#f472b6" />
                <YAxis stroke="#f472b6" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #fbcfe8",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="visits" fill="#f472b6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Visitor Origins */}
        <Card className="border-pink-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-pink-700 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Visitor Origins
            </CardTitle>
          </CardHeader>
          <CardContent>
            {countryData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={countryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {countryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-pink-400">
                <div className="text-center">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No visitor data yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Stats */}
        <Card className="border-pink-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-pink-700 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-pink-50 rounded-lg">
              <p className="text-sm text-pink-500">Most Active Day</p>
              <p className="text-lg font-semibold text-pink-700">
                {weeklyData.reduce((max, d) => (d.visits > max.visits ? d : max), weeklyData[0])?.day || "N/A"}
              </p>
            </div>
            <div className="p-4 bg-pink-50 rounded-lg">
              <p className="text-sm text-pink-500">Top Visitor Country</p>
              <p className="text-lg font-semibold text-pink-700">
                {countryData[0]?.name || "N/A"}
              </p>
            </div>
            <div className="p-4 bg-pink-50 rounded-lg">
              <p className="text-sm text-pink-500">Weekly Total</p>
              <p className="text-lg font-semibold text-pink-700">
                {weeklyData.reduce((sum, d) => sum + d.visits, 0)} visitors
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantInsights;
