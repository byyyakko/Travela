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
import { Plus, MoreHorizontal, MapPin, Calendar as CalendarIcon, Check, Trash2 } from "lucide-react";
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

const CutesyPlanner = () => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-red-500";
      case "completed": return "text-green-600";
      default: return "text-blue-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <Card className="p-5 cutesy-grid-bg cutesy-border bg-card/95">
        <h1 className="text-2xl font-bold text-primary mb-4 cutesy-underline inline-block">
          Plan ✈️
        </h1>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6 text-base border-2 border-primary/30">
              <Plus className="w-5 h-5 mr-2" />
              Create a Plan +
            </Button>
          </DialogTrigger>
          <DialogContent className="cutesy-border bg-card max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-primary cutesy-underline inline-block">
                Create a Plan
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 mt-4">
              {/* Trip Name */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Trip Name
                </label>
                <Input
                  placeholder="e.g., Japan 2025"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  className="border-2 border-primary/50 rounded-xl"
                />
              </div>

              {/* Country Selection */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Where are you going?
                </label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="border-2 border-primary/50 rounded-xl">
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
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Dates
                </label>
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range || { from: undefined })}
                  className="rounded-xl border-2 border-primary/50 p-3 pointer-events-auto"
                  numberOfMonths={1}
                />
              </div>

              {/* Interests */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
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
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-transparent hover:border-primary/50"
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
                className="w-full rounded-full bg-primary hover:bg-primary/90 font-semibold py-6"
              >
                Create Trip ✨
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>

      {/* Trips List */}
      <div>
        <h2 className="text-lg font-bold text-foreground cutesy-underline inline-block mb-4">
          Plans
        </h2>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips?.length === 0 ? (
          <Card className="p-8 text-center cutesy-border bg-card/90">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              No trips planned yet. Create your first adventure! ✨
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {trips?.map((trip) => (
              <Card
                key={trip.id}
                className="p-4 cutesy-border bg-card/95 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{getCountryFlag(trip.country)}</span>
                  <div>
                    <h3 className="font-bold text-foreground">{trip.name}</h3>
                    {trip.start_date && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(trip.start_date), "MMM d")}
                        {trip.end_date && ` - ${format(new Date(trip.end_date), "MMM d, yyyy")}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-xs font-bold capitalize",
                    getStatusColor(trip.status)
                  )}>
                    {trip.status === "active" && "● "}
                    {trip.status}
                  </span>

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
                        <span className="text-red-500 mr-2">●</span> Set Active
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateTripStatus.mutate({ id: trip.id, status: "completed" })}
                      >
                        <Check className="w-4 h-4 mr-2 text-green-600" /> Mark Completed
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CutesyPlanner;
