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

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--ring))", "hsl(var(--muted-foreground))", "hsl(var(--secondary-foreground))"];

const SIMULATED_WEEKLY = [
  { day: "Mon", visits: 24 },
  { day: "Tue", visits: 31 },
  { day: "Wed", visits: 18 },
  { day: "Thu", visits: 42 },
  { day: "Fri", visits: 56 },
  { day: "Sat", visits: 73 },
  { day: "Sun", visits: 61 },
];

const SIMULATED_COUNTRIES = [
  { name: "Singapore", value: 41 },
  { name: "Japan", value: 27 },
  { name: "USA", value: 19 },
  { name: "South Korea", value: 12 },
  { name: "Australia", value: 9 },
];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Insights</h1>
        <p className="text-muted-foreground mt-1">
          Detailed analytics for {store?.store_name || "your store"}
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Simulated Data
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Weekly Visitors", value: totalWeekly.toString(), icon: Users, accent: "from-primary to-primary/70" },
          { label: "Busiest Day", value: busiestDay.day, icon: TrendingUp, accent: "from-accent to-accent/70" },
          { label: "Top Travellers' Country", value: "Japan", icon: Globe, accent: "from-ring to-ring/70" },
          { label: "Avg Daily", value: Math.round(totalWeekly / 7).toString(), icon: MapPin, accent: "from-accent to-primary" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border bg-card/80 backdrop-blur overflow-hidden">
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.accent} flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Weekly Traffic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SIMULATED_WEEKLY}>
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
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

        <Card className="border-border bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Utensils className="w-5 h-5" />
              Popular Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SIMULATED_POPULAR_ITEMS.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.orders} orders</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      style={{ width: `${(item.orders / SIMULATED_POPULAR_ITEMS[0].orders) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Star className="w-5 h-5" />
            Peak Time Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Busiest Hour</p>
              <p className="text-lg font-semibold text-foreground">12:00 – 1:00 PM</p>
              <p className="text-xs text-muted-foreground mt-1">Lunch rush</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Quietest Day</p>
              <p className="text-lg font-semibold text-foreground">Wednesday</p>
              <p className="text-xs text-muted-foreground mt-1">18 visitors avg</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Return Visitors</p>
              <p className="text-lg font-semibold text-foreground">34%</p>
              <p className="text-xs text-muted-foreground mt-1">Came back within 7 days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantInsights;
