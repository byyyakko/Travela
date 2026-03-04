import { useState, useEffect } from "react";
import { useNavigate, NavLink, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Store, Home, BarChart3, Crown, LogOut, Menu, X, Package, Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface StoreData {
  id: string;
  store_name: string;
  store_type: string;
  subscription_tier: string;
}

const MerchantDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchStore = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("stores")
        .select("id, store_name, store_type, subscription_tier")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching store:", error);
        toast({ title: "Error", description: "Could not load your store data.", variant: "destructive" });
      } else {
        setStore(data);
      }
      setLoading(false);
    };

    fetchStore();
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const navItems = [
    { to: "/merchant-dashboard", icon: Home, label: "Home", end: true },
    { to: "/merchant-dashboard/products", icon: Package, label: "Products" },
    { to: "/merchant-dashboard/insights", icon: BarChart3, label: "Insights" },
    { to: "/merchant-dashboard/plan", icon: Crown, label: "Plan" },
    { to: "/merchant-dashboard/settings", icon: Settings, label: "Settings" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-card/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground" aria-label="Go back to role selection">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground truncate max-w-[200px]">{store?.store_name || "My Store"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-muted-foreground">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card/90 backdrop-blur border-r border-border transform transition-transform duration-200 ease-in-out lg:transform-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-border hidden lg:block">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Go back to role selection">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground truncate">{store?.store_name || "My Store"}</h2>
                  <p className="text-xs text-muted-foreground capitalize">{store?.store_type?.replace("_", " ") || "Store"}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 mt-16 lg:mt-0">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                      isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-border">
              <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted">
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="flex-1 p-4 lg:p-8 min-h-screen">
          <Outlet context={{ store }} />
        </main>
      </div>
    </div>
  );
};

export default MerchantDashboard;
