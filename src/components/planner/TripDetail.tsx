import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArrowLeft, Plus, MapPin, Clock, Trash2, Utensils, Camera, ShoppingBag, Landmark, Plane } from "lucide-react";
import { toast } from "sonner";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { motion } from "framer-motion";
import mascotCutesy from "@/assets/mascot-cutesy.png";

interface TripDetailProps {
  trip: {
    id: string;
    name: string;
    country: string;
    start_date: string | null;
    end_date: string | null;
    interests: string[] | null;
    status: string;
  };
  onBack: () => void;
}

const categories = [
  { value: "activity", label: "Activity", icon: Camera },
  { value: "food", label: "Food", icon: Utensils },
  { value: "transport", label: "Transport", icon: Plane },
  { value: "shopping", label: "Shopping", icon: ShoppingBag },
  { value: "sightseeing", label: "Sightseeing", icon: Landmark },
];

const countries: Record<string, { name: string; flag: string }> = {
  JP: { name: "Japan", flag: "🇯🇵" },
  ID: { name: "Indonesia", flag: "🇮🇩" },
  SG: { name: "Singapore", flag: "🇸🇬" },
  TH: { name: "Thailand", flag: "🇹🇭" },
  KR: { name: "South Korea", flag: "🇰🇷" },
  VN: { name: "Vietnam", flag: "🇻🇳" },
  PH: { name: "Philippines", flag: "🇵🇭" },
  MY: { name: "Malaysia", flag: "🇲🇾" },
  FR: { name: "France", flag: "🇫🇷" },
  IT: { name: "Italy", flag: "🇮🇹" },
  ES: { name: "Spain", flag: "🇪🇸" },
  US: { name: "United States", flag: "🇺🇸" },
};

const floatAnimation = {
  y: [0, -8, 0],
  transition: {
    duration: 2.5,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

const TripDetail = ({ trip, onBack }: TripDetailProps) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    time: "",
    location: "",
    category: "activity",
  });

  // Generate array of days for the trip
  const tripDays = useMemo(() => {
    if (!trip.start_date || !trip.end_date) return [];
    try {
      return eachDayOfInterval({
        start: parseISO(trip.start_date),
        end: parseISO(trip.end_date),
      });
    } catch {
      return [];
    }
  }, [trip.start_date, trip.end_date]);

  // Fetch itinerary items
  const { data: itineraryItems, isLoading } = useQuery({
    queryKey: ["itinerary", trip.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", trip.id)
        .order("day_date", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Add itinerary item
  const addItem = useMutation({
    mutationFn: async () => {
      if (!selectedDay) return;
      const { error } = await supabase.from("itinerary_items").insert({
        trip_id: trip.id,
        user_id: user!.id,
        day_date: selectedDay,
        title: newItem.title,
        description: newItem.description || null,
        time: newItem.time || null,
        location: newItem.location || null,
        category: newItem.category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itinerary", trip.id] });
      setIsDialogOpen(false);
      setNewItem({ title: "", description: "", time: "", location: "", category: "activity" });
      toast.success("Activity added! ✨");
    },
    onError: () => toast.error("Failed to add activity"),
  });

  // Delete itinerary item
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("itinerary_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itinerary", trip.id] });
      toast.success("Activity removed");
    },
  });

  const getItemsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return itineraryItems?.filter(item => item.day_date === dateStr) || [];
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.icon || Camera;
  };

  const isCutesy = theme === "cutesy";
  const countryInfo = countries[trip.country] || { name: trip.country, flag: "🌍" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className={cn(
        "p-5 relative overflow-hidden",
        isCutesy && "cutesy-grid-bg cutesy-border bg-card/95"
      )}>
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{countryInfo.flag}</span>
              <h1 className={cn(
                "text-xl font-bold text-primary",
                isCutesy && "cutesy-underline"
              )}>
                {trip.name}
              </h1>
            </div>
            {trip.start_date && trip.end_date && (
              <p className="text-sm text-muted-foreground mt-1">
                {format(parseISO(trip.start_date), "MMM d")} - {format(parseISO(trip.end_date), "MMM d, yyyy")}
              </p>
            )}
          </div>
          {isCutesy && (
            <motion.img
              src={mascotCutesy}
              alt="Cute cat mascot"
              className="w-14 h-14 object-contain drop-shadow-md mix-blend-multiply"
              animate={floatAnimation}
            />
          )}
        </div>

        {trip.interests && trip.interests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {trip.interests.map((interest) => (
              <span
                key={interest}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold",
                  isCutesy
                    ? "bg-secondary text-secondary-foreground border-2 border-primary/20"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {interest}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Itinerary by Day */}
      {tripDays.length === 0 ? (
        <Card className={cn("p-8 text-center", isCutesy && "cutesy-border bg-card/90")}>
          <p className="text-muted-foreground">
            Set start and end dates to create your itinerary!
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className={cn(
            "text-lg font-bold text-foreground",
            isCutesy && "cutesy-underline inline-block"
          )}>
            Itinerary
          </h2>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            tripDays.map((day, index) => {
              const dayItems = getItemsForDay(day);
              const dateStr = format(day, "yyyy-MM-dd");

              return (
                <Card
                  key={dateStr}
                  className={cn(
                    "p-4",
                    isCutesy && "cutesy-border bg-card/95"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className={cn(
                        "text-xs font-bold uppercase tracking-wide",
                        isCutesy ? "text-accent" : "text-muted-foreground"
                      )}>
                        Day {index + 1}
                      </span>
                      <h3 className="font-bold text-foreground">
                        {format(day, "EEEE, MMM d")}
                      </h3>
                    </div>
                    <Dialog open={isDialogOpen && selectedDay === dateStr} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (open) setSelectedDay(dateStr);
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            "rounded-full",
                            isCutesy && "border-2 border-primary/50"
                          )}
                          onClick={() => setSelectedDay(dateStr)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent className={cn(isCutesy && "cutesy-border bg-card")}>
                        <DialogHeader>
                          <DialogTitle className={cn(
                            "text-lg font-bold text-primary",
                            isCutesy && "cutesy-underline inline-block"
                          )}>
                            Add Activity
                          </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 mt-4">
                          <div>
                            <label className="text-sm font-semibold text-foreground mb-2 block">
                              What are you doing?
                            </label>
                            <Input
                              placeholder="e.g., Visit Sensoji Temple"
                              value={newItem.title}
                              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                              className={cn(isCutesy && "border-2 border-primary/50 rounded-xl")}
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-foreground mb-2 block">
                              Category
                            </label>
                            <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                              <SelectTrigger className={cn(isCutesy && "border-2 border-primary/50 rounded-xl")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    <span className="flex items-center gap-2">
                                      <cat.icon className="w-4 h-4" />
                                      {cat.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm font-semibold text-foreground mb-2 block">
                                Time (optional)
                              </label>
                              <Input
                                type="time"
                                value={newItem.time}
                                onChange={(e) => setNewItem({ ...newItem, time: e.target.value })}
                                className={cn(isCutesy && "border-2 border-primary/50 rounded-xl")}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-semibold text-foreground mb-2 block">
                                Location (optional)
                              </label>
                              <Input
                                placeholder="e.g., Asakusa"
                                value={newItem.location}
                                onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                                className={cn(isCutesy && "border-2 border-primary/50 rounded-xl")}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-foreground mb-2 block">
                              Notes (optional)
                            </label>
                            <Textarea
                              placeholder="Any additional details..."
                              value={newItem.description}
                              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                              className={cn(isCutesy && "border-2 border-primary/50 rounded-xl")}
                              rows={2}
                            />
                          </div>

                          <Button
                            onClick={() => addItem.mutate()}
                            disabled={!newItem.title}
                            className={cn(
                              "w-full font-semibold",
                              isCutesy && "rounded-full py-6"
                            )}
                          >
                            Add Activity ✨
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {dayItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No activities planned yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dayItems.map((item) => {
                        const CategoryIcon = getCategoryIcon(item.category);
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-xl bg-secondary/50",
                              isCutesy && "border border-primary/10"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              isCutesy ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary"
                            )}>
                              <CategoryIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground text-sm">
                                {item.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                {item.time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {item.time}
                                  </span>
                                )}
                                {item.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {item.location}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteItem.mutate(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default TripDetail;
