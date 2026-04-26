import { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase, supabaseLovable } from "@/integrations/supabase/client";
import { uploadAndModerate } from "@/lib/moderateImage";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { MapPin, Store, Phone, Save, Loader2, Map, Globe, Link2, FileText, ImagePlus, X, Trash2, Leaf } from "lucide-react";

const MerchantMapPreview = lazy(() => import("@/components/map/MerchantMapPreview"));

interface StoreContext {
  store: {
    id: string;
    store_name: string;
    store_type: string;
    subscription_tier: string;
  } | null;
}

interface StoreImage {
  id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
}

const MerchantSettings = () => {
  const { user } = useAuth();
  const { store } = useOutletContext<StoreContext>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    store_name: "",
    store_type: "food" as "food" | "attractions" | "entertainment",
    phone: "",
    address: "",
    country: "",
    description: "",
    website_url: "",
    dietary_options: [] as string[],
  });
  const [storeImages, setStoreImages] = useState<StoreImage[]>([]);
  const [originalAddress, setOriginalAddress] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const fetchStoreDetails = async () => {
      if (!user) return;
      const { data, error } = await supabase.from("stores").select("store_name, store_type, phone, address, country, description, website_url, dietary_options, latitude, longitude").eq("user_id", user.id).single();
      if (error) {
        console.error("Error fetching store:", error);
        toast({ title: "Error", description: "Could not load store details.", variant: "destructive" });
      } else if (data) {
        setFormData({
          store_name: data.store_name || "", store_type: data.store_type || "food", phone: data.phone || "",
          address: data.address || "", country: data.country || "", description: data.description || "",
          website_url: data.website_url || "", dietary_options: data.dietary_options || [],
        });
        setOriginalAddress(data.address || "");
        if (data.latitude && data.longitude) setCoordinates({ lat: data.latitude, lng: data.longitude });
      }
      setLoading(false);
    };
    const fetchStoreImages = async () => {
      if (!store?.id) return;
      const { data, error } = await supabase.from("store_images").select("*").eq("store_id", store.id).order("display_order", { ascending: true });
      if (!error && data) setStoreImages(data);
    };
    fetchStoreDetails();
    if (store?.id) fetchStoreImages();
  }, [user, store?.id]);

  const handlePreviewLocation = async () => {
    if (!formData.address.trim()) { toast({ title: "Address required", description: "Please enter an address to preview on the map.", variant: "destructive" }); return; }
    setPreviewLoading(true);
    try {
      const { data: geocodeData, error: geocodeError } = await supabaseLovable.functions.invoke('geocode-address', { body: { address: formData.address } });
      if (geocodeError) throw new Error(geocodeError.message);
      if (geocodeData?.latitude && geocodeData?.longitude) {
        setCoordinates({ lat: geocodeData.latitude, lng: geocodeData.longitude });
        toast({ title: "📍 Location Found", description: geocodeData.formattedAddress || "Location displayed on map" });
      } else {
        toast({ title: "Location not found", description: "Could not find this address. Please try a more specific address.", variant: "destructive" });
      }
    } catch (err) {
      console.error('Preview geocoding failed:', err);
      toast({ title: "Error", description: "Could not find location. Please try again.", variant: "destructive" });
    }
    setPreviewLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store?.id) return;
    if (storeImages.length >= 5) { toast({ title: "Limit reached", description: "You can upload a maximum of 5 store images.", variant: "destructive" }); return; }
    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${store.id}/${Date.now()}.${fileExt}`;
      const { publicUrl: urlPublic } = await uploadAndModerate("store-items", fileName, file);
      const { data: imageData, error: insertError } = await supabase.from("store_images").insert({ store_id: store.id, image_url: urlPublic, display_order: storeImages.length }).select().single();
      if (insertError) throw insertError;
      setStoreImages([...storeImages, imageData]);
      toast({ title: "Image uploaded", description: "Your store image has been added." });
    } catch (err) {
      console.error("Image upload failed:", err);
      toast({ title: "Upload failed", description: "Could not upload image. Please try again.", variant: "destructive" });
    }
    setUploadingImage(false);
    e.target.value = "";
  };

  const handleDeleteImage = async (imageId: string, imageUrl: string) => {
    try {
      const urlParts = imageUrl.split("/store-items/");
      const filePath = urlParts[1];
      if (filePath) await supabase.storage.from("store-items").remove([filePath]);
      const { error } = await supabase.from("store_images").delete().eq("id", imageId);
      if (error) throw error;
      setStoreImages(storeImages.filter(img => img.id !== imageId));
      toast({ title: "Image deleted", description: "Store image has been removed." });
    } catch (err) {
      console.error("Delete failed:", err);
      toast({ title: "Delete failed", description: "Could not delete image.", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!user || !store?.id) return;
    setSaving(true);
    let latitude: number | null = coordinates?.lat || null;
    let longitude: number | null = coordinates?.lng || null;
    if (formData.address && formData.address !== originalAddress && !coordinates) {
      setGeocoding(true);
      try {
        const { data: geocodeData, error: geocodeError } = await supabaseLovable.functions.invoke('geocode-address', { body: { address: formData.address } });
        if (geocodeError) {
          console.error('Geocoding error:', geocodeError);
          toast({ title: "Warning", description: "Could not geocode address. Store will be saved without map coordinates.", variant: "destructive" });
        } else if (geocodeData?.latitude && geocodeData?.longitude) {
          latitude = geocodeData.latitude;
          longitude = geocodeData.longitude;
          setCoordinates({ lat: latitude, lng: longitude });
        }
      } catch (err) { console.error('Geocoding failed:', err); }
      setGeocoding(false);
    }
    const updateData: Record<string, unknown> = {
      store_name: formData.store_name, store_type: formData.store_type, phone: formData.phone,
      address: formData.address, country: formData.country, description: formData.description,
      website_url: formData.website_url, dietary_options: formData.dietary_options,
    };
    if (latitude !== null && longitude !== null) { updateData.latitude = latitude; updateData.longitude = longitude; }
    const { error } = await supabase.from("stores").update(updateData).eq("id", store.id);
    if (error) {
      console.error("Error updating store:", error);
      toast({ title: "Error", description: "Could not save store settings.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Store settings saved successfully!" });
      setOriginalAddress(formData.address);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Store Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your store information</p>
      </div>

      <Card className="border-border bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Store className="w-5 h-5" />
            Store Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store_name">Store Name</Label>
            <Input id="store_name" value={formData.store_name} onChange={(e) => setFormData({ ...formData, store_name: e.target.value })} placeholder="Enter your store name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="store_type">Store Type</Label>
            <Select value={formData.store_type} onValueChange={(value: "food" | "attractions" | "entertainment") => setFormData({ ...formData, store_type: value })}>
              <SelectTrigger><SelectValue placeholder="Select store type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="food">🍜 Food</SelectItem>
                <SelectItem value="attractions">🏛️ Attractions</SelectItem>
                <SelectItem value="entertainment">🍷 Nightlife</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.store_type === "food" && (
            <div className="space-y-3">
              <Label><Leaf className="w-4 h-4 inline mr-1" />Dietary Options</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "vegan", label: "🌱 Vegan Friendly" },
                  { value: "vegetarian", label: "🥬 Vegetarian" },
                  { value: "halal", label: "☪️ Halal" },
                  { value: "non-halal", label: "🍖 Non-Halal" },
                ].map((option) => (
                  <div key={option.value} className="flex items-center space-x-2 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={option.value}
                      checked={formData.dietary_options.includes(option.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, dietary_options: [...formData.dietary_options, option.value] });
                        } else {
                          setFormData({ ...formData, dietary_options: formData.dietary_options.filter((v) => v !== option.value) });
                        }
                      }}
                    />
                    <Label htmlFor={option.value} className="text-sm cursor-pointer">{option.label}</Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Select all that apply to help travelers find suitable food options</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description"><FileText className="w-4 h-4 inline mr-1" />Store Description</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="min-h-[100px]" placeholder="Tell travelers about your store..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url"><Link2 className="w-4 h-4 inline mr-1" />Website URL (Optional)</Label>
            <Input id="website_url" type="url" value={formData.website_url} onChange={(e) => setFormData({ ...formData, website_url: e.target.value })} placeholder="https://your-website.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country"><Globe className="w-4 h-4 inline mr-1" />Country</Label>
            <Input id="country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} placeholder="e.g. Singapore, Japan, Thailand" />
            <p className="text-xs text-muted-foreground">This helps travelers find your store when searching by destination</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone"><Phone className="w-4 h-4 inline mr-1" />Phone Number</Label>
            <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Enter phone number" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address"><MapPin className="w-4 h-4 inline mr-1" />Store Address</Label>
            <div className="flex gap-2">
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  if (e.target.value !== originalAddress) setCoordinates(null);
                }}
                placeholder="Enter your store address"
              />
              <Button type="button" variant="outline" onClick={handlePreviewLocation} disabled={previewLoading || !formData.address.trim()} className="shrink-0 gap-2">
                {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Map className="w-5 h-5" /><span className="hidden sm:inline">Find on Map</span></>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Click the <Map className="w-3 h-3 inline" /> map button to preview your location</p>
          </div>

          {coordinates && (
            <div className="space-y-2">
              <Label>📍 Location Preview</Label>
              <Suspense fallback={
                <div className="w-full h-64 rounded-lg border-2 border-border flex items-center justify-center bg-muted/50">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              }>
                <MerchantMapPreview latitude={coordinates.lat} longitude={coordinates.lng} storeName={formData.store_name || "Your Store"} storeType={formData.store_type} />
              </Suspense>
              <p className="text-xs text-muted-foreground text-center">✓ Location verified at {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground"><ImagePlus className="w-5 h-5" />Store Photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Add photos of your storefront, products, or ambiance (max 5 images)</p>
          {storeImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {storeImages.map((image) => (
                <div key={image.id} className="relative group">
                  <img src={image.image_url} alt="Store" className="w-full h-24 object-cover rounded-lg border-2 border-border" />
                  <button onClick={() => handleDeleteImage(image.id, image.image_url)} className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {storeImages.length < 5 && (
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              {uploadingImage ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <><ImagePlus className="w-5 h-5 text-primary" /><span className="text-primary font-medium">Add Photo</span></>
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
            </label>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || geocoding} className="w-full">
        {saving || geocoding ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{geocoding ? "Finding location..." : "Saving..."}</>
        ) : (
          <><Save className="w-4 h-4 mr-2" />Save Settings</>
        )}
      </Button>
    </div>
  );
};

export default MerchantSettings;
