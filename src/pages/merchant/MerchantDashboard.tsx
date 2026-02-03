import { useState, useEffect } from "react";
import { useNavigate, NavLink, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Store, Home, BarChart3, Crown, LogOut, Menu, X, Package, Settings } from "lucide-react";
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
        toast({
          title: "Error",
          description: "Could not load your store data.",
          variant: "destructive",
        });
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 to-pink-100">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-pink-100">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white/80 backdrop-blur border-b border-pink-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
            <Store className="w-4 h-4 text-pink-500" />
          </div>
          <span className="font-semibold text-pink-700 truncate max-w-[200px]">
            {store?.store_name || "My Store"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-pink-600"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/90 backdrop-blur border-r border-pink-200 transform transition-transform duration-200 ease-in-out lg:transform-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="flex flex-col h-full">
            {/* Store Info */}
            <div className="p-6 border-b border-pink-100 hidden lg:block">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                  <Store className="w-6 h-6 text-pink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-pink-700 truncate">
                    {store?.store_name || "My Store"}
                  </h2>
                  <p className="text-xs text-pink-400 capitalize">
                    {store?.store_type?.replace("_", " ") || "Store"}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
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
                      isActive
                        ? "bg-pink-100 text-pink-700 font-medium"
                        : "text-pink-500 hover:bg-pink-50"
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Sign Out */}
            <div className="p-4 border-t border-pink-100">
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start text-pink-500 hover:text-pink-700 hover:bg-pink-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 min-h-screen">
          <Outlet context={{ store }} />
        </main>
      </div>
    </div>
  );
};

export default MerchantDashboard;
