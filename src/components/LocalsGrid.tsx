import LocalCard from "./LocalCard";

const locals = [
  {
    name: "Sofia Martinez",
    location: "Barcelona, Spain",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face",
    rating: 4.9,
    reviews: 127,
    specialties: ["Tapas Tours", "Hidden Bars", "Local Markets"],
    bio: "Born and raised in the Gothic Quarter. I'll show you the Barcelona tourists never see!",
  },
  {
    name: "Kenji Tanaka",
    location: "Tokyo, Japan",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    rating: 5.0,
    reviews: 89,
    specialties: ["Ramen Spots", "Night Photography", "Sake Tasting"],
    bio: "Food photographer by day, izakaya explorer by night. Let's find the best hidden ramen!",
  },
  {
    name: "Amara Okonkwo",
    location: "Marrakech, Morocco",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=face",
    rating: 4.8,
    reviews: 203,
    specialties: ["Spice Markets", "Traditional Cuisine", "Artisan Crafts"],
    bio: "Third-generation spice merchant. I'll take you through the real Medina experience.",
  },
  {
    name: "Marco Rossi",
    location: "Rome, Italy",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face",
    rating: 4.9,
    reviews: 156,
    specialties: ["Pasta Making", "Wine Cellars", "Ancient History"],
    bio: "Chef and history buff. Discover Rome through its food and forgotten stories.",
  },
  {
    name: "Priya Sharma",
    location: "Mumbai, India",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face",
    rating: 4.7,
    reviews: 94,
    specialties: ["Street Food", "Bollywood Tours", "Temple Visits"],
    bio: "From dabbawalas to dance bars, I know every corner of this incredible city.",
  },
  {
    name: "Lucas Chen",
    location: "Taipei, Taiwan",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    rating: 4.9,
    reviews: 112,
    specialties: ["Night Markets", "Tea Culture", "Mountain Hikes"],
    bio: "Tech worker turned full-time food guide. My mission: find you the perfect xiaolongbao.",
  },
];

const LocalsGrid = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-4">
            Meet Our Featured Locals
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Passionate locals ready to share their city's best-kept secrets with you.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {locals.map((local) => (
            <LocalCard key={local.name} {...local} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default LocalsGrid;