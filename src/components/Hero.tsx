import heroImage from "@/assets/hero-travel.jpg";
import { Button } from "@/components/ui/button";
import { MapPin, Users } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Travelers connecting with locals over food"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/50 via-foreground/30 to-foreground/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/20 backdrop-blur-sm text-primary-foreground text-sm font-medium">
            <Users className="w-4 h-4" />
            Join 10,000+ travelers & locals
          </span>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-semibold text-primary-foreground leading-tight">
            Discover the world through 
            <span className="text-primary"> local eyes</span>
          </h1>
          
          <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Connect with passionate locals who share their favorite hidden gems, 
            authentic food spots, and cultural treasures. Experience travel like never before.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="text-lg px-8 py-6" onClick={() => window.location.href = '/auth'}>
              Find a Local Guide
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-6 bg-background/10 backdrop-blur-sm border-primary-foreground/30 text-primary-foreground hover:bg-background/20"
              onClick={() => window.location.href = '/auth'}
            >
              <MapPin className="w-5 h-5 mr-2" />
              Explore Destinations
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;