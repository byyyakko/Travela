import { MessageCircle, Search, Star } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Browse Local Guides",
    description: "Explore profiles of locals who share your interests in food, culture, or adventure.",
  },
  {
    icon: MessageCircle,
    title: "Connect & Chat",
    description: "Send a message, plan your meetup, and get personalized recommendations.",
  },
  {
    icon: Star,
    title: "Experience Together",
    description: "Meet up for an authentic experience and make memories that last a lifetime.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 bg-secondary">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-4">
            How LocalConnect Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Three simple steps to unlock authentic travel experiences with locals who love their city.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-border" />
              )}
              
              <div className="relative bg-card rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-all duration-300 group-hover:-translate-y-1">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>
                
                <span className="absolute top-6 right-6 text-6xl font-display font-bold text-muted/50">
                  {index + 1}
                </span>
                
                <h3 className="text-xl font-display font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;