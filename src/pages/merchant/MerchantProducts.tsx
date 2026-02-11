import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndModerate } from "@/lib/moderateImage";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Image, Utensils, MapPin, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { containsProfanity } from "@/lib/profanity";

interface StoreItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  ordering_tip: string | null;
  price: string | null;
}

interface StoreData {
  id: string;
  store_name: string;
  store_type: "food" | "attractions" | "entertainment";
  subscription_tier: string;
}

const MerchantProducts = () => {
  const { user } = useAuth();
  const { store } = useOutletContext<{ store: StoreData | null }>();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    ordering_tip: "",
    price: "",
    image_url: "",
  });

  const isFood = store?.store_type === "food";

  useEffect(() => {
    if (store?.id) {
      fetchItems();
    }
  }, [store?.id]);

  const fetchItems = async () => {
    if (!store?.id) return;

    const { data, error } = await supabase
      .from("store_items")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching items:", error);
      toast({
        title: "Error",
        description: "Could not load your items.",
        variant: "destructive",
      });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    try {
      const { publicUrl } = await uploadAndModerate("store-items", fileName, file);
      setFormData((prev) => ({ ...prev, image_url: publicUrl }));
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    }
    setUploading(false);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      ordering_tip: "",
      price: "",
      image_url: "",
    });
    setEditingItem(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (item: StoreItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      ordering_tip: item.ordering_tip || "",
      price: item.price || "",
      image_url: item.image_url || "",
    });
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setDialogOpen(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;

    // Profanity checks
    const fieldsToCheck = [
      { value: formData.name, name: "name" },
      { value: formData.description, name: "description" },
      { value: formData.ordering_tip, name: "ordering tip" },
    ];
    for (const field of fieldsToCheck) {
      if (containsProfanity(field.value)) {
        toast({ title: "Inappropriate content", description: `Your ${field.name} contains inappropriate language.`, variant: "destructive" });
        return;
      }
    }

    const itemData = {
      name: formData.name,
      description: formData.description || null,
      image_url: formData.image_url || null,
      ordering_tip: isFood ? formData.ordering_tip || null : null,
      price: !isFood ? formData.price || null : null,
    };

    if (editingItem) {
      // Update existing item
      const { error } = await supabase
        .from("store_items")
        .update(itemData)
        .eq("id", editingItem.id);

      if (error) {
        toast({
          title: "Error",
          description: "Could not update item.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Item updated successfully!",
        });
        resetForm();
        setDialogOpen(false);
        fetchItems();
      }
    } else {
      // Create new item
      const { error } = await supabase.from("store_items").insert({
        store_id: store.id,
        ...itemData,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Could not add item.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Item added successfully!",
        });
        resetForm();
        setDialogOpen(false);
        fetchItems();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("store_items").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Could not delete item.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Item removed successfully.",
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const getPageTitle = () => {
    if (isFood) return "Menu Items";
    return "Attractions & Activities";
  };

  const getItemLabel = () => {
    if (isFood) return "Dish";
    return "Activity";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pink-700">{getPageTitle()}</h1>
          <p className="text-pink-500 text-sm mt-1">
            {isFood
              ? "Add your dishes with ordering tips for travelers"
              : "Showcase what visitors can do and experience"}
          </p>
        </div>

        <Button
          onClick={openAddDialog}
          className="bg-pink-500 hover:bg-pink-600 text-white rounded-full gap-2"
        >
          <Plus className="w-4 h-4" />
          Add {getItemLabel()}
        </Button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-pink-700">
              {editingItem ? `Edit ${getItemLabel()}` : `Add New ${getItemLabel()}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-pink-600">Photo</Label>
              {formData.image_url ? (
                <div className="relative">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-xl border-2 border-dashed border-pink-200"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, image_url: "" }))
                    }
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-pink-200 rounded-xl cursor-pointer hover:bg-pink-50 transition-colors">
                  <Image className="w-8 h-8 text-pink-300 mb-2" />
                  <span className="text-sm text-pink-400">
                    {uploading ? "Uploading..." : "Click to upload image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-pink-600">{getItemLabel()} Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={isFood ? "e.g., Pad Thai" : "e.g., Temple Tour"}
                required
                className="border-pink-200 focus:border-pink-400"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-pink-600">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder={
                  isFood
                    ? "Describe the dish, ingredients, spice level..."
                    : "What can visitors do and experience here?"
                }
                className="border-pink-200 focus:border-pink-400"
                rows={3}
              />
            </div>

            {/* Conditional Fields */}
            {isFood ? (
              <div className="space-y-2">
                <Label className="text-pink-600 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  How to Order Like a Local
                </Label>
                <Textarea
                  value={formData.ordering_tip}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      ordering_tip: e.target.value,
                    }))
                  }
                  placeholder='e.g., "Ask for extra lime and crushed peanuts on the side!"'
                  className="border-pink-200 focus:border-pink-400"
                  rows={2}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-pink-600">Price / Entry Fee</Label>
                <Input
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder="e.g., $15 per person, Free entry"
                  className="border-pink-200 focus:border-pink-400"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-full"
            >
              {editingItem ? "Save Changes" : `Add ${getItemLabel()}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Items Grid */}
      {items.length === 0 ? (
        <Card className="border-2 border-dashed border-pink-200 bg-white/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            {isFood ? (
              <Utensils className="w-12 h-12 text-pink-300 mb-4" />
            ) : (
              <MapPin className="w-12 h-12 text-pink-300 mb-4" />
            )}
            <p className="text-pink-500 text-center">
              No items yet. Add your first {getItemLabel().toLowerCase()}!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="bg-white/80 border-pink-100 overflow-hidden group"
            >
              {item.image_url && (
                <div className="relative h-40">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="bg-white/90 hover:bg-white"
                      onClick={() => openEditDialog(item)}
                    >
                      <Pencil className="w-4 h-4 text-pink-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <CardHeader className={item.image_url ? "pb-2" : ""}>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg text-pink-700">
                    {item.name}
                  </CardTitle>
                  {!item.image_url && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-pink-400 hover:text-pink-600 hover:bg-pink-50"
                        onClick={() => openEditDialog(item)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-pink-400 hover:text-pink-600 hover:bg-pink-50"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.description && (
                  <p className="text-sm text-pink-600">{item.description}</p>
                )}
                {isFood && item.ordering_tip && (
                  <div className="bg-pink-50 rounded-lg p-3 border border-pink-100">
                    <p className="text-xs text-pink-400 flex items-center gap-1 mb-1">
                      <Sparkles className="w-3 h-3" />
                      Order like a local
                    </p>
                    <p className="text-sm text-pink-600 italic">
                      "{item.ordering_tip}"
                    </p>
                  </div>
                )}
                {!isFood && item.price && (
                  <div className="bg-pink-50 rounded-lg px-3 py-2 inline-block">
                    <p className="text-sm font-medium text-pink-700">
                      {item.price}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Note */}
      <Card className="bg-pink-50/50 border-pink-100">
        <CardContent className="py-4">
          <p className="text-sm text-pink-500 text-center">
            {isFood
              ? "💡 These items will appear as an informational menu for travelers. No ordering functionality."
              : "💡 This is an infographic display for travelers. Purchasing is handled at your location."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantProducts;
