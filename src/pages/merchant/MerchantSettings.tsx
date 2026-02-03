import { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { MapPin, Store, Phone, Save, Loader2, Search, Map } from "lucide-react";

const MerchantMapPreview = lazy(() => import("@/components/map/MerchantMapPreview"));

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
  const [geocoding, setGeocoding] = useState(false);
  const [formData, setFormData] = useState({
    store_name: "",
    store_type: "food" as "food" | "attractions" | "entertainment",
    phone: "",
    address: "",
  });
  const [originalAddress, setOriginalAddress] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  useEffect(() => {
    const fetchStoreDetails = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("stores")
        .select("store_name, store_type, phone, address, latitude, longitude")
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
        setOriginalAddress(data.address || "");
        if (data.latitude && data.longitude) {
          setCoordinates({ lat: data.latitude, lng: data.longitude });
        }
      }
      setLoading(false);
    };

    fetchStoreDetails();
  }, [user]);

  const handlePreviewLocation = async () => {
    if (!formData.address.trim()) {
      toast({
        title: "Address required",
        description: "Please enter an address to preview on the map.",
        variant: "destructive",
      });
      return;
    }

    setPreviewLoading(true);
    try {
      const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke(
        'geocode-address',
        { body: { address: formData.address } }
      );

      if (geocodeError) {
        throw new Error(geocodeError.message);
      }

      if (geocodeData?.latitude && geocodeData?.longitude) {
        setCoordinates({ lat: geocodeData.latitude, lng: geocodeData.longitude });
        toast({
          title: "📍 Location Found",
          description: geocodeData.formattedAddress || "Location displayed on map",
        });
      } else {
        toast({
          title: "Location not found",
          description: "Could not find this address. Please try a more specific address.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Preview geocoding failed:', err);
      toast({
        title: "Error",
        description: "Could not find location. Please try again.",
        variant: "destructive",
      });
    }
    setPreviewLoading(false);
  };

  const handleSave = async () => {
    if (!user || !store?.id) return;
    
    setSaving(true);
    
    let latitude: number | null = coordinates?.lat || null;
    let longitude: number | null = coordinates?.lng || null;

    // Geocode the address if it changed and we don't have coordinates
    if (formData.address && formData.address !== originalAddress && !coordinates) {
      setGeocoding(true);
      try {
        const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke(
          'geocode-address',
          { body: { address: formData.address } }
        );

        if (geocodeError) {
          console.error('Geocoding error:', geocodeError);
          toast({
            title: "Warning",
            description: "Could not geocode address. Store will be saved without map coordinates.",
            variant: "destructive",
          });
        } else if (geocodeData?.latitude && geocodeData?.longitude) {
          latitude = geocodeData.latitude;
          longitude = geocodeData.longitude;
          setCoordinates({ lat: latitude, lng: longitude });
        }
      } catch (err) {
        console.error('Geocoding failed:', err);
      }
      setGeocoding(false);
    }
    
    const updateData: Record<string, unknown> = {
      store_name: formData.store_name,
      store_type: formData.store_type,
      phone: formData.phone,
      address: formData.address,
    };

    // Update coordinates
    if (latitude !== null && longitude !== null) {
      updateData.latitude = latitude;
      updateData.longitude = longitude;
    }

    const { error } = await supabase
      .from("stores")
      .update(updateData)
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
      setOriginalAddress(formData.address);
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
            <div className="flex gap-2">
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  // Clear coordinates when address changes
                  if (e.target.value !== originalAddress) {
                    setCoordinates(null);
                  }
                }}
                className="border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                placeholder="Enter your store address"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewLocation}
                disabled={previewLoading || !formData.address.trim()}
                className="border-pink-300 text-pink-600 hover:bg-pink-50 shrink-0 gap-2"
              >
                {previewLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Map className="w-5 h-5" />
                    <span className="hidden sm:inline">Find on Map</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-pink-400">
              Click the <Map className="w-3 h-3 inline" /> map button to preview your location
            </p>
          </div>

          {/* Map Preview */}
          {coordinates && (
            <div className="space-y-2">
              <Label className="text-pink-600">📍 Location Preview</Label>
              <Suspense fallback={
                <div className="w-full h-64 rounded-lg border-2 border-pink-200 flex items-center justify-center bg-pink-50">
                  <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
                </div>
              }>
                <MerchantMapPreview
                  latitude={coordinates.lat}
                  longitude={coordinates.lng}
                  storeName={formData.store_name || "Your Store"}
                  storeType={formData.store_type}
                />
              </Suspense>
              <p className="text-xs text-pink-400 text-center">
                ✓ Location verified at {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving || geocoding}
        className="w-full bg-pink-500 hover:bg-pink-600 text-white"
      >
        {saving || geocoding ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {geocoding ? "Finding location..." : "Saving..."}
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
