import { useNavigate } from "react-router-dom";
import { useTheme, ThemeStyle } from "@/contexts/ThemeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart, Zap, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const themes: { id: ThemeStyle; name: string; description: string; icon: React.ReactNode; colors: string[] }[] = [
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Clean, warm, and inviting design with terracotta tones and elegant typography",
    icon: <Sparkles className="w-6 h-6" />,
    colors: ["#C17B5F", "#F5EFE6", "#6B8E6B"],
  },
  {
    id: "cutesy",
    name: "Cutesy",
    description: "Playful and charming with soft pastels, rounded edges, and cute illustrations",
    icon: <Heart className="w-6 h-6" />,
    colors: ["#FFB6C1", "#E6E6FA", "#98FB98"],
  },
  {
    id: "anime",
    name: "Anime-Style",
    description: "Vibrant and immersive with bold colors, dynamic illustrations, and glowing effects",
    icon: <Zap className="w-6 h-6" />,
    colors: ["#FF6B9D", "#4ECDC4", "#FFE66D"],
  },
];

const ThemeSelect = () => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleSelect = async (selectedTheme: ThemeStyle) => {
    await setTheme(selectedTheme);
  };

  const handleContinue = () => {
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-4 py-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-display font-bold text-foreground">
            Choose Your Style
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Pick a theme that matches your personality. You can change this anytime in your profile settings.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {themes.map((t) => (
            <Card
              key={t.id}
              className={cn(
                "cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1",
                theme === t.id && "ring-2 ring-primary shadow-card-hover"
              )}
              onClick={() => handleSelect(t.id)}
            >
              <CardHeader className="text-center pb-4">
                <div className={cn(
                  "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-colors",
                  t.id === "minimalist" && "bg-primary/10 text-primary",
                  t.id === "cutesy" && "bg-pink-100 text-pink-500",
                  t.id === "anime" && "bg-purple-100 text-purple-500"
                )}>
                  {t.icon}
                </div>
                <CardTitle className="flex items-center justify-center gap-2">
                  {t.name}
                  {theme === t.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center gap-2">
                  {t.colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full shadow-sm border border-border/50"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center pt-4">
          <Button size="lg" onClick={handleContinue} className="px-12">
            Continue to Travela
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSelect;
