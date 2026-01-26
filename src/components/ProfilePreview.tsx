import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Globe, Calendar, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import VerifiedBadge from "@/components/VerifiedBadge";

interface ProfilePreviewProps {
  displayName: string;
  bio: string;
  location: string;
  avatarUrl: string | null;
  isLocal: boolean;
  isVerified: boolean;
  interests: string[];
  languages: string[];
  dateOfBirth: string;
  destination?: string;
  travelStartDate?: string;
  travelEndDate?: string;
}

const ProfilePreview = ({
  displayName,
  bio,
  location,
  avatarUrl,
  isLocal,
  isVerified,
  interests,
  languages,
  dateOfBirth,
  destination,
  travelStartDate,
  travelEndDate,
}: ProfilePreviewProps) => {
  const { theme } = useTheme();

  const calculateAge = (dob: string): number | null => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(dateOfBirth);

  return (
    <Card className={cn(
      "overflow-hidden",
      theme === "cutesy" && "border-pink-200 shadow-pink-100",
      theme === "anime" && "border-purple-500/30 bg-purple-900/50"
    )}>
      {/* Profile Image */}
      <div className={cn(
        "aspect-[3/4] relative",
        theme === "cutesy" && "bg-gradient-to-br from-pink-100 to-purple-100",
        theme === "anime" && "bg-gradient-to-br from-purple-800 to-slate-900"
      )}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName || "Profile"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Avatar className="w-32 h-32">
              <AvatarFallback className={cn(
                "text-4xl",
                theme === "cutesy" && "bg-pink-200 text-pink-600",
                theme === "anime" && "bg-purple-700 text-cyan-400"
              )}>
                {(displayName || "U")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

        {/* Profile info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <span>
              {displayName || "Your Name"}
              {age && (
                <span className="text-xl font-normal ml-2">, {age}</span>
              )}
            </span>
            {isVerified && <VerifiedBadge size="lg" />}
          </h2>
          {location && (
            <p className="flex items-center gap-1 mt-1 text-white/80">
              <MapPin className="w-4 h-4" />
              {location}
            </p>
          )}
          {bio && (
            <p className="mt-3 text-sm text-white/90 line-clamp-3">
              {bio}
            </p>
          )}
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {interests.slice(0, 4).map((interest, i) => (
                <span
                  key={i}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs",
                    theme === "minimalist" && "bg-white/20",
                    theme === "cutesy" && "bg-pink-500/50",
                    theme === "anime" && "bg-cyan-500/30 border border-cyan-400/50"
                  )}
                >
                  {interest}
                </span>
              ))}
              {interests.length > 4 && (
                <span className="px-2 py-1 text-xs text-white/60">
                  +{interests.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Additional info section */}
      <div className={cn(
        "p-4 space-y-3",
        theme === "anime" && "bg-purple-900/30"
      )}>
        {/* Languages */}
        {languages.length > 0 && (
          <div className="flex items-center gap-2">
            <Globe className={cn(
              "w-4 h-4",
              theme === "anime" ? "text-cyan-400" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-sm",
              theme === "anime" ? "text-purple-200" : "text-muted-foreground"
            )}>
              Speaks: {languages.join(", ")}
            </span>
          </div>
        )}

        {/* Role indicator */}
        <div className={cn(
          "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm",
          isLocal
            ? theme === "anime"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : theme === "cutesy"
              ? "bg-pink-100 text-pink-600"
              : "bg-primary/10 text-primary"
            : theme === "anime"
            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
            : theme === "cutesy"
            ? "bg-purple-100 text-purple-600"
            : "bg-secondary text-secondary-foreground"
        )}>
          {isLocal ? (
            <>
              <MapPin className="w-3 h-3" />
              Local Guide
            </>
          ) : (
            <>
              <Plane className="w-3 h-3" />
              Traveler
            </>
          )}
        </div>

        {/* Travel info for travelers */}
        {!isLocal && destination && (
          <div className={cn(
            "p-3 rounded-lg",
            theme === "anime" ? "bg-purple-800/50" : "bg-muted"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Plane className={cn(
                "w-4 h-4",
                theme === "anime" ? "text-cyan-400" : "text-primary"
              )} />
              <span className={cn(
                "font-medium",
                theme === "anime" && "text-white"
              )}>
                Traveling to {destination}
              </span>
            </div>
            {(travelStartDate || travelEndDate) && (
              <div className={cn(
                "flex items-center gap-1 text-sm",
                theme === "anime" ? "text-purple-300" : "text-muted-foreground"
              )}>
                <Calendar className="w-3 h-3" />
                {travelStartDate && travelEndDate
                  ? `${new Date(travelStartDate).toLocaleDateString()} - ${new Date(travelEndDate).toLocaleDateString()}`
                  : travelStartDate
                  ? `From ${new Date(travelStartDate).toLocaleDateString()}`
                  : `Until ${new Date(travelEndDate!).toLocaleDateString()}`}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ProfilePreview;
