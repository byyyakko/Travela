import { MapPin, Star, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LocalCardProps {
  name: string;
  location: string;
  image: string;
  rating: number;
  reviews: number;
  specialties: string[];
  bio: string;
}

const LocalCard = ({ name, location, image, rating, reviews, specialties, bio }: LocalCardProps) => {
  return (
    <div className="group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1">
      {/* Image */}
      <div className="relative h-56 overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-sm">
          <Star className="w-4 h-4 text-primary fill-primary" />
          <span className="font-medium text-sm">{rating}</span>
          <span className="text-muted-foreground text-sm">({reviews})</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-display font-semibold text-foreground">
              {name}
            </h3>
            <p className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
              <MapPin className="w-4 h-4" />
              {location}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
          {bio}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {specialties.map((specialty) => (
            <Badge key={specialty} variant="secondary" className="text-xs">
              {specialty}
            </Badge>
          ))}
        </div>

        <Button className="w-full group/btn">
          <MessageCircle className="w-4 h-4 mr-2 group-hover/btn:animate-pulse" />
          Connect with {name.split(" ")[0]}
        </Button>
      </div>
    </div>
  );
};

export default LocalCard;