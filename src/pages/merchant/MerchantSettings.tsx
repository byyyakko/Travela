import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { MapPin, Store, Phone, Save, Loader2 } from "lucide-react";

interface StoreContext {
  store: {
    id: string;
    store_name: string;
    store_type: string;
    subscription_tier: string;
  } | null;
}

const MerchantSettings = () => {
  const { user } = useAuth();
  const { store } = useOutletContext<StoreContext>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    store_name: "",
    store_type: "food" as "food" | "attractions" | "entertainment",
    phone: "",
    address: "",
  });

  useEffect(() => {
    const fetchStoreDetails = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("stores")
        .select("store_name, store_type, phone, address")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching store:", error);
        toast({
          title: "Error",
          description: "Could not load store details.",
          variant: "destructive",
        });
      } else if (data) {
        setFormData({
          store_name: data.store_name || "",
          store_type: data.store_type || "food",
          phone: data.phone || "",
          address: data.address || "",
        });
      }
      setLoading(false);
    };

    fetchStoreDetails();
  }, [user]);

  const handleSave = async () => {
    if (!user || !store?.id) return;
    
    setSaving(true);
    
    const { error } = await supabase
      .from("stores")
      .update({
        store_name: formData.store_name,
        store_type: formData.store_type,
        phone: formData.phone,
        address: formData.address,
      })
      .eq("id", store.id);

    if (error) {
      console.error("Error updating store:", error);
      toast({
        title: "Error",
        description: "Could not save store settings.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Store settings saved successfully!",
      });
      // Refresh the page to update the sidebar
      window.location.reload();
    }
    
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-pink-700">Store Settings</h1>
        <p className="text-pink-500 mt-1">Manage your store information</p>
      </div>

      <Card className="border-pink-200 bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-pink-700">
            <Store className="w-5 h-5" />
            Store Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store_name" className="text-pink-600">Store Name</Label>
            <Input
              id="store_name"
              value={formData.store_name}
              onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
              className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
              placeholder="Enter your store name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store_type" className="text-pink-600">Store Type</Label>
            <Select
              value={formData.store_type}
              onValueChange={(value: "food" | "attractions" | "entertainment") => 
                setFormData({ ...formData, store_type: value })
              }
            >
              <SelectTrigger className="border-pink-200 focus:border-pink-400 focus:ring-pink-400">
                <SelectValue placeholder="Select store type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food">🍜 Food</SelectItem>
                <SelectItem value="attractions">🏛️ Attractions</SelectItem>
                <SelectItem value="entertainment">🎮 Entertainment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-pink-600">
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
              placeholder="Enter phone number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-pink-600">
              <MapPin className="w-4 h-4 inline mr-1" />
              Store Address
            </Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
              placeholder="Enter your store address"
            />
            <p className="text-xs text-pink-400">
              This address will be used to show your store location on the map
            </p>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-pink-500 hover:bg-pink-600 text-white"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </>
        )}
      </Button>
    </div>
  );
};

export default MerchantSettings;
