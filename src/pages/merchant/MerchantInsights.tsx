import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, TrendingUp, Star, MapPin, Users, Utensils } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useOutletContext } from "react-router-dom";

interface StoreContext {
  store: {
    id: string;
    store_name: string;
    store_type: string;
    subscription_tier: string;
  } | null;
}

const COLORS = ["#f472b6", "#c084fc", "#60a5fa", "#34d399", "#fbbf24"];

// Simulated weekly traffic data
const SIMULATED_WEEKLY = [
  { day: "Mon", visits: 24 },
  { day: "Tue", visits: 31 },
  { day: "Wed", visits: 18 },
  { day: "Thu", visits: 42 },
  { day: "Fri", visits: 56 },
  { day: "Sat", visits: 73 },
  { day: "Sun", visits: 61 },
];

// Simulated visitor origins
const SIMULATED_COUNTRIES = [
  { name: "Singapore", value: 41 },
  { name: "Japan", value: 27 },
  { name: "USA", value: 19 },
  { name: "South Korea", value: 12 },
  { name: "Australia", value: 9 },
];

// Simulated popular items
const SIMULATED_POPULAR_ITEMS = [
  { name: "Matcha Latte", orders: 142 },
  { name: "Tonkotsu Ramen", orders: 118 },
  { name: "Mochi Set", orders: 97 },
  { name: "Green Tea Cake", orders: 84 },
  { name: "Onigiri Platter", orders: 71 },
];

const MerchantInsights = () => {
  const { store } = useOutletContext<StoreContext>();

  const totalWeekly = SIMULATED_WEEKLY.reduce((sum, d) => sum + d.visits, 0);
  const busiestDay = SIMULATED_WEEKLY.reduce((max, d) => (d.visits > max.visits ? d : max), SIMULATED_WEEKLY[0]);
  const topCountry = SIMULATED_COUNTRIES[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pink-700">Insights</h1>
        <p className="text-pink-500 mt-1">
          Detailed analytics for {store?.store_name || "your store"}
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-600">
            Simulated Data
          </span>
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Weekly Visitors", value: totalWeekly.toString(), icon: Users, accent: "from-pink-500 to-rose-500" },
          { label: "Busiest Day", value: busiestDay.day, icon: TrendingUp, accent: "from-purple-500 to-indigo-500" },
          { label: "Top Country", value: topCountry.name, icon: Globe, accent: "from-blue-500 to-cyan-500" },
          { label: "Avg Daily", value: Math.round(totalWeekly / 7).toString(), icon: MapPin, accent: "from-emerald-500 to-teal-500" },
        ].map((stat) => (
          <Card key={stat.label} className="border-pink-200 bg-white/80 backdrop-blur overflow-hidden">
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.accent} flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-pink-700">{stat.value}</p>
              <p className="text-xs text-pink-400 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
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
              <BarChart data={SIMULATED_WEEKLY}>
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
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={SIMULATED_COUNTRIES}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {SIMULATED_COUNTRIES.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Popular Items */}
        <Card className="border-pink-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-pink-700 flex items-center gap-2">
              <Utensils className="w-5 h-5" />
              Popular Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SIMULATED_POPULAR_ITEMS.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-sm font-bold text-pink-400 w-6">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-pink-700">{item.name}</span>
                    <span className="text-xs text-pink-400">{item.orders} orders</span>
                  </div>
                  <div className="h-2 bg-pink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full"
                      style={{ width: `${(item.orders / SIMULATED_POPULAR_ITEMS[0].orders) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card className="border-pink-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-pink-700 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Peak Time Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-pink-50 rounded-lg">
              <p className="text-sm text-pink-500">Busiest Hour</p>
              <p className="text-lg font-semibold text-pink-700">12:00 – 1:00 PM</p>
              <p className="text-xs text-pink-400 mt-1">Lunch rush</p>
            </div>
            <div className="p-4 bg-pink-50 rounded-lg">
              <p className="text-sm text-pink-500">Quietest Day</p>
              <p className="text-lg font-semibold text-pink-700">Wednesday</p>
              <p className="text-xs text-pink-400 mt-1">18 visitors avg</p>
            </div>
            <div className="p-4 bg-pink-50 rounded-lg">
              <p className="text-sm text-pink-500">Return Visitors</p>
              <p className="text-lg font-semibold text-pink-700">34%</p>
              <p className="text-xs text-pink-400 mt-1">Came back within 7 days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantInsights;
