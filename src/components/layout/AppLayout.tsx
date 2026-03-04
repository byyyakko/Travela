import { ReactNode, useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Home, Users, User, MessageCircle, Search, Settings, CalendarDays, MessageSquareHeart, DoorOpen, CircleDot, Compass, Globe, Sparkles, Bath } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/layout/BackButton";
import ToriTanChat from "@/components/ToriTanChat";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import bgCute from "@/assets/bg-cute.png";
import mascotImg from "@/assets/mascot-cutesy.png";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/home", icon: Home, label: "Home", tour: "home" },
  { path: "/experiences", icon: Compass, label: "Explore", tour: "explore" },
  { path: "/match", icon: Sparkles, label: "For You", tour: "for-you" },
  { path: "/ask-local", icon: Globe, label: "Ask Local", tour: "ask-local" },
  { path: "/planner", icon: CalendarDays, label: "Plan", tour: "plan" },
  { path: "/messages", icon: MessageCircle, label: "Chat", tour: "chat" },
  { path: "/circles", icon: CircleDot, label: "Circles", tour: "circles" },
  { path: "/toilet-finder", icon: Bath, label: "Toilet", tour: "toilet" },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    fetchAvatar();
  }, [user]);

  return (
    <div 
      className="min-h-screen pb-20 md:pb-0 md:pl-20 bg-background"
    >
      {/* Top bar with search */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 py-3 md:left-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {/* Back Button - shows on non-primary routes */}
          <BackButton className="text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0" />
          
          <div className="flex items-center gap-2">
            <img src={mascotImg} alt="Travela mascot" className="w-16 h-16 object-contain mix-blend-multiply -my-3" />
            <span className="text-xl font-sans font-bold text-primary">
              Travela
            </span>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search destinations, locals..."
                className="pl-10 bg-background border-2 border-primary/50 focus:border-primary rounded-full"
              />
            </div>
          </div>
          <Link to="/profile" data-tour="profile">
            <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
              <AvatarImage src={avatarUrl || undefined} alt="Profile" />
              <AvatarFallback className="bg-secondary text-muted-foreground">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          </Link>
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-secondary">
              <Settings className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto py-6">
          {children}
        </div>
      </main>

      {/* Bottom navigation (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/98 backdrop-blur-md border-t-2 border-foreground/10">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-tour={item.tour}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                  isActive && "text-foreground",
                  !isActive && "text-foreground/50 hover:text-foreground/80"
                )}
              >
                <div className={cn(
                  isActive && "bg-primary text-primary-foreground p-2 rounded-full -mt-6 shadow-md border-2 border-foreground/10"
                )}>
                  <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
                </div>
                <span className="text-xs font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Side navigation (desktop) */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 hidden md:flex flex-col items-center py-6 z-50 bg-background/98 backdrop-blur-md border-r border-border">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-8 bg-secondary border-2 border-primary">
          <img src={mascotImg} alt="Travela mascot" className="w-14 h-14 object-contain mix-blend-multiply" />
        </div>

        <div className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-tour={item.tour}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                  isActive && "bg-secondary border-2 border-primary text-primary",
                  !isActive && "text-muted-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Tori-Tan AI Chat */}
      <ToriTanChat />

      {/* Onboarding Tutorial */}
      <OnboardingTutorial />
    </div>
  );
};

export default AppLayout;
