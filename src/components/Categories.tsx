import { UtensilsCrossed, Landmark, Compass, Music } from "lucide-react";

const categories = [
  {
    icon: UtensilsCrossed,
    name: "Local Food",
    count: "2,450 guides",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Landmark,
    name: "Hidden Attractions",
    count: "1,890 guides",
    color: "bg-accent/10 text-accent",
  },
  {
    icon: Compass,
    name: "Adventures",
    count: "1,230 guides",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Music,
    name: "Culture & Nightlife",
    count: "980 guides",
    color: "bg-accent/10 text-accent",
  },
];

const Categories = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-6">
        <div className="flex flex-wrap justify-center gap-4">
          {categories.map((category) => (
            <button
              key={category.name}
              className="group flex items-center gap-3 px-6 py-4 rounded-full bg-card border border-border hover:border-primary/30 hover:shadow-card transition-all duration-300"
            >
              <div className={`p-2 rounded-full ${category.color} group-hover:scale-110 transition-transform`}>
                <category.icon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">{category.name}</p>
                <p className="text-sm text-muted-foreground">{category.count}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;