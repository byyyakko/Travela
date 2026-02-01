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
    <Card className="overflow-hidden border-pink-200 shadow-pink-100">
      {/* Profile Image */}
      <div className="aspect-[3/4] relative bg-gradient-to-br from-pink-100 to-purple-100">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName || "Profile"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Avatar className="w-32 h-32">
              <AvatarFallback className="text-4xl bg-pink-200 text-pink-600">
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
                  className="px-2 py-1 rounded-full text-xs bg-pink-500/50"
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
      <div className="p-4 space-y-3">
        {/* Languages */}
        {languages.length > 0 && (
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Speaks: {languages.join(", ")}
            </span>
          </div>
        )}

        {/* Role indicator */}
        <div className={cn(
          "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm",
          isLocal
            ? "bg-pink-100 text-pink-600"
            : "bg-purple-100 text-purple-600"
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
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-4 h-4 text-primary" />
              <span className="font-medium">
                Traveling to {destination}
              </span>
            </div>
            {(travelStartDate || travelEndDate) && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
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
