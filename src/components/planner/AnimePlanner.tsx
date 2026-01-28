import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Plus, MoreHorizontal, MapPin, Check, Trash2, Sparkles, Compass } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import bgAnime from "@/assets/bg-anime.png";

const countries = [
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "US", name: "United States", flag: "🇺🇸" },
];

const interestOptions = [
  "Museums", "Hiking", "Cafe hopping", "Food tours", "Shopping", 
  "Beaches", "Nightlife", "Culture", "Adventure", "Photography"
];

const AnimePlanner = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tripName, setTripName] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date | undefined }>({ from: undefined });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trips").insert({
        user_id: user!.id,
        name: tripName,
        country: selectedCountry,
        start_date: dateRange.from?.toISOString().split('T')[0],
        end_date: dateRange.to?.toISOString().split('T')[0],
        interests: selectedInterests,
        status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success("Trip created! ✨");
    },
    onError: () => toast.error("Failed to create trip"),
  });

  const updateTripStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("trips")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip updated!");
    },
  });

  const deleteTrip = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip deleted");
    },
  });

  const resetForm = () => {
    setTripName("");
    setSelectedCountry("");
    setDateRange({ from: undefined });
    setSelectedInterests([]);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const getCountryFlag = (countryCode: string) => {
    return countries.find(c => c.code === countryCode)?.flag || "🌍";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground">
            ✦ Active
          </span>
        );
      case "completed":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-secondary text-secondary-foreground">
            ✓ Completed
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent/20 text-accent">
            Planned
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Anime-style header with background */}
      <Card className="relative overflow-hidden border-2 border-primary/30 bg-card/80 backdrop-blur-sm shadow-[var(--shadow-card)]">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url(${bgAnime})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-accent animate-pulse" />
                <span className="text-sm font-medium text-accent">旅の計画</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Travel Plans ✨</h1>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full blur-md opacity-50" />
              <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Compass className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-to-r from-primary via-primary to-accent hover:opacity-90 text-primary-foreground font-bold py-6 border-2 border-primary-foreground/20 rounded-xl transition-all hover:scale-[1.02]">
                <Plus className="w-5 h-5 mr-2" />
                Create a Plan ✦
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card/95 backdrop-blur-sm border-2 border-primary/30 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Create a Plan
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-4">
                {/* Trip Name */}
                <div>
                  <label className="text-sm font-bold text-foreground mb-2 block">
                    Trip Name
                  </label>
                  <Input
                    placeholder="e.g., Tokyo Adventure 2025"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="bg-background/80 border-2 border-primary/40 rounded-xl focus-visible:border-accent"
                  />
                </div>

                {/* Country Selection */}
                <div>
                  <label className="text-sm font-bold text-foreground mb-2 block">
                    Where are you going?
                  </label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="bg-background/80 border-2 border-primary/40 rounded-xl">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <span className="flex items-center gap-2">
                            <span>{country.flag}</span>
                            <span>{country.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="text-sm font-bold text-foreground mb-2 block">
                    Dates
                  </label>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range || { from: undefined })}
                    className="rounded-xl border-2 border-primary/40 p-3 pointer-events-auto bg-background/50"
                    numberOfMonths={1}
                  />
                </div>

                {/* Interests */}
                <div>
                  <label className="text-sm font-bold text-foreground mb-2 block">
                    Interests (pick at least 3)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((interest) => (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-semibold transition-all border-2",
                          selectedInterests.includes(interest)
                            ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-transparent"
                            : "bg-background/50 text-foreground border-primary/30 hover:border-accent"
                        )}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => createTrip.mutate()}
                  disabled={!tripName || !selectedCountry || selectedInterests.length < 3}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 font-bold py-6 rounded-xl"
                >
                  Create Trip ✨
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Trips List */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-foreground">Your Adventures</h2>
          <span className="text-accent">✦</span>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips?.length === 0 ? (
          <Card className="p-10 text-center bg-card/80 backdrop-blur-sm border-2 border-primary/20">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-accent" />
            <p className="text-muted-foreground">
              No trips planned yet. Start your adventure! ✨
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {trips?.map((trip) => (
              <Card
                key={trip.id}
                className="p-4 bg-card/80 backdrop-blur-sm border-2 border-primary/20 hover:border-accent/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full blur-sm opacity-30" />
                      <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-secondary flex items-center justify-center text-2xl border-2 border-primary/30">
                        {getCountryFlag(trip.country)}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{trip.name}</h3>
                      {trip.start_date && (
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(trip.start_date), "MMM d")}
                          {trip.end_date && ` - ${format(new Date(trip.end_date), "MMM d, yyyy")}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(trip.status)}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-sm border-primary/30">
                        <DropdownMenuItem
                          onClick={() => updateTripStatus.mutate({ id: trip.id, status: "active" })}
                        >
                          <Sparkles className="w-4 h-4 mr-2 text-accent" /> Set Active
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateTripStatus.mutate({ id: trip.id, status: "completed" })}
                        >
                          <Check className="w-4 h-4 mr-2 text-primary" /> Mark Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteTrip.mutate(trip.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {trip.interests && trip.interests.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {trip.interests.map((interest: string) => (
                      <span
                        key={interest}
                        className="px-3 py-1 rounded-full text-xs bg-accent/20 text-accent font-medium"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimePlanner;
