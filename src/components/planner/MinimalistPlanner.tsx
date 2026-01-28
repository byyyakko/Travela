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
import { Plus, MoreHorizontal, MapPin, Check, Trash2, Plane } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

const MinimalistPlanner = () => {
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
      toast.success("Trip created successfully");
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
      toast.success("Trip updated");
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
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary">Active</span>;
      case "completed":
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent">Completed</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">Planned</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="p-6 bg-card border border-border shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Travel Plans</h1>
            <p className="text-muted-foreground mt-1">Organize your upcoming adventures</p>
          </div>
          <Plane className="w-10 h-10 text-primary" />
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6">
              <Plus className="w-5 h-5 mr-2" />
              Create New Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-foreground">
                Create a Plan
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Trip Name */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Trip Name
                </label>
                <Input
                  placeholder="e.g., Summer in Italy"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  className="bg-secondary/50 border-0 focus-visible:ring-primary"
                />
              </div>

              {/* Country Selection */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Destination
                </label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="bg-secondary/50 border-0">
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
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Travel Dates
                </label>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range || { from: undefined })}
                  className="rounded-lg border border-border p-3 pointer-events-auto"
                  numberOfMonths={1}
                />
              </div>

              {/* Interests */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Interests (pick at least 3)
                </label>
                <div className="flex flex-wrap gap-2">
                  {interestOptions.map((interest) => (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all",
                        selectedInterests.includes(interest)
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
                className="w-full bg-primary hover:bg-primary/90 font-medium py-6"
              >
                Create Trip
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>

      {/* Trips List */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Your Trips</h2>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips?.length === 0 ? (
          <Card className="p-12 text-center bg-card border border-border">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground text-lg">
              No trips planned yet. Start your journey.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {trips?.map((trip) => (
              <Card
                key={trip.id}
                className="p-5 bg-card border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-2xl">
                      {getCountryFlag(trip.country)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{trip.name}</h3>
                      {trip.start_date && (
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(trip.start_date), "MMM d")}
                          {trip.end_date && ` - ${format(new Date(trip.end_date), "MMM d, yyyy")}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {getStatusBadge(trip.status)}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => updateTripStatus.mutate({ id: trip.id, status: "active" })}
                        >
                          Set Active
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => updateTripStatus.mutate({ id: trip.id, status: "completed" })}
                        >
                          <Check className="w-4 h-4 mr-2" /> Mark Completed
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
                  <div className="flex flex-wrap gap-2 mt-4">
                    {trip.interests.map((interest: string) => (
                      <span
                        key={interest}
                        className="px-3 py-1 rounded-full text-xs bg-muted text-muted-foreground"
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

export default MinimalistPlanner;
