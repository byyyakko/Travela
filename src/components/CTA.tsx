import { Button } from "@/components/ui/button";
import { ArrowRight, Heart } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-24 bg-primary">
      <div className="container mx-auto px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 text-primary-foreground text-sm">
            <Heart className="w-4 h-4 fill-current" />
            Join our community
          </div>
          
          <h2 className="text-3xl md:text-5xl font-display font-semibold text-primary-foreground">
            Ready to travel like a local?
          </h2>
          
          <p className="text-lg text-primary-foreground/80 max-w-xl mx-auto">
            Sign up today and start connecting with locals who are eager to share 
            their passion for their hometown with travelers like you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg px-8 py-6 group"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-6 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
            >
              Become a Local Guide
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;