import { useState } from "react";
import { aiPhrases } from "@/lib/aiClient";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Globe, Volume2, Sparkles, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import mascotCutesy from "@/assets/mascot-cutesy.png";

interface Phrase {
  local: string;
  english: string;
  pronunciation: string;
}

interface PhraseCategory {
  category: string;
  phrases: Phrase[];
}

interface PhrasesData {
  country: string;
  language: string;
  phrases: PhraseCategory[];
}

const popularCountries = [
  { name: "Japan", flag: "🇯🇵" },
  { name: "South Korea", flag: "🇰🇷" },
  { name: "Thailand", flag: "🇹🇭" },
  { name: "France", flag: "🇫🇷" },
  { name: "Spain", flag: "🇪🇸" },
  { name: "Indonesia", flag: "🇮🇩" },
  { name: "Vietnam", flag: "🇻🇳" },
  { name: "Italy", flag: "🇮🇹" },
];

const categoryEmojis: Record<string, string> = {
  Greetings: "👋",
  Dining: "🍜",
  Directions: "🗺️",
  Shopping: "🛍️",
  Emergency: "🚨",
};

const CommonPhrases = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [phrasesData, setPhrasesData] = useState<PhrasesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetchPhrases = async (country: string) => {
    setIsLoading(true);
    setPhrasesData(null);
    setActiveCategory(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await aiPhrases(country);

      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }

      setPhrasesData(data);
      if (data?.phrases?.length > 0) {
        setActiveCategory(data.phrases[0].category);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to fetch phrases. Try again!", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      fetchPhrases(searchQuery.trim());
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-primary">Common Phrases</h1>
          <p className="text-sm text-muted-foreground">Learn essential phrases for your trip</p>
        </div>

        {/* Free badge */}
        <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30">
          <Sparkles className="w-3 h-3 mr-1" /> Free for all travelers
        </Badge>

        {/* Search */}
        <Card className="p-4 cutesy-border bg-card/95">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search a country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 border-2 border-primary/50 rounded-full"
              />
            </div>
            <Button onClick={handleSearch} disabled={!searchQuery.trim() || isLoading} className="rounded-full">
              <Globe className="w-4 h-4 mr-1" /> Go
            </Button>
          </div>

          {/* Quick picks */}
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">Popular:</p>
            <div className="flex flex-wrap gap-2">
              {popularCountries.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setSearchQuery(c.name);
                    fetchPhrases(c.name);
                  }}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-secondary hover:bg-secondary/80 transition-colors border border-primary/20"
                >
                  {c.flag} {c.name}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Loading state */}
        {isLoading && (
          <Card className="p-8 text-center cutesy-border bg-card/95">
            <motion.img
              src={mascotCutesy}
              alt="Loading mascot"
              className="w-20 h-20 mx-auto mb-4 object-contain mix-blend-multiply"
              animate={{ y: [0, -8, 0], transition: { duration: 1.5, repeat: Infinity } }}
            />
            <p className="text-muted-foreground">Looking up phrases...</p>
          </Card>
        )}

        {/* Results */}
        {phrasesData && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="p-4 cutesy-border bg-card/95">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-primary">{phrasesData.country}</h2>
              </div>
              <p className="text-sm text-muted-foreground">Language: {phrasesData.language}</p>
            </Card>

            {/* Category tabs */}
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {phrasesData.phrases.map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() => setActiveCategory(cat.category)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border-2 ${
                      activeCategory === cat.category
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-secondary-foreground border-transparent hover:border-primary/50"
                    }`}
                  >
                    {categoryEmojis[cat.category] || "📝"} {cat.category}
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Phrases list */}
            <div className="space-y-3">
              {phrasesData.phrases
                .filter((cat) => cat.category === activeCategory)
                .flatMap((cat) => cat.phrases)
                .map((phrase, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="p-4 cutesy-border bg-card/95">
                      <p className="text-lg font-bold text-foreground">{phrase.local}</p>
                      <p className="text-sm text-primary font-medium mt-1">/{phrase.pronunciation}/</p>
                      <p className="text-sm text-muted-foreground mt-1">{phrase.english}</p>
                    </Card>
                  </motion.div>
                ))}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!phrasesData && !isLoading && (
          <Card className="p-8 text-center cutesy-border bg-card/90">
            <motion.img
              src={mascotCutesy}
              alt="Mascot"
              className="w-24 h-24 object-contain mx-auto mb-4 opacity-80 mix-blend-multiply"
              animate={{ y: [0, -8, 0], transition: { duration: 2.5, repeat: Infinity } }}
            />
            <p className="text-muted-foreground">
              Search for a country to see common phrases! 🌏
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default CommonPhrases;
