import { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { Home, Users, User, MessageCircle, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/home", icon: Home, label: "Home" },
  { path: "/match", icon: Users, label: "Match" },
  { path: "/messages", icon: MessageCircle, label: "Messages" },
  { path: "/profile", icon: User, label: "Profile" },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const { theme } = useTheme();

  return (
    <div className={cn(
      "min-h-screen pb-20 md:pb-0 md:pl-20",
      theme === "cutesy" && "bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50",
      theme === "anime" && "bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900",
      theme === "minimalist" && "bg-background"
    )}>
      {/* Top bar with search */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-40 px-4 py-3 md:left-20",
        theme === "minimalist" && "bg-background/80 backdrop-blur-md border-b border-border/50",
        theme === "cutesy" && "bg-white/80 backdrop-blur-md border-b-2 border-pink-200",
        theme === "anime" && "bg-slate-900/90 backdrop-blur-md border-b border-purple-500/30"
      )}>
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xl font-display font-bold",
              theme === "minimalist" && "text-primary",
              theme === "cutesy" && "text-pink-500",
              theme === "anime" && "text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400"
            )}>
              Travela
            </span>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                theme === "anime" ? "text-purple-400" : "text-muted-foreground"
              )} />
              <Input
                placeholder="Search destinations, locals..."
                className={cn(
                  "pl-10",
                  theme === "cutesy" && "bg-pink-50 border-pink-200 focus:border-pink-400 rounded-full",
                  theme === "anime" && "bg-purple-900/50 border-purple-500/30 text-white placeholder:text-purple-300 rounded-lg"
                )}
              />
            </div>
          </div>
          <Link to="/settings">
            <Button variant="ghost" size="icon" className={cn(
              theme === "anime" && "text-purple-300 hover:text-white hover:bg-purple-800/50"
            )}>
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
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        theme === "minimalist" && "bg-background/95 backdrop-blur-md border-t border-border/50",
        theme === "cutesy" && "bg-white/95 backdrop-blur-md border-t-2 border-pink-200",
        theme === "anime" && "bg-slate-900/95 backdrop-blur-md border-t border-purple-500/30"
      )}>
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                  theme === "minimalist" && (isActive ? "text-primary" : "text-muted-foreground"),
                  theme === "cutesy" && (isActive ? "text-pink-500 bg-pink-100" : "text-gray-400"),
                  theme === "anime" && (isActive ? "text-cyan-400 bg-purple-800/50" : "text-purple-300")
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Side navigation (desktop) */}
      <nav className={cn(
        "fixed left-0 top-0 bottom-0 w-20 hidden md:flex flex-col items-center py-6 z-50",
        theme === "minimalist" && "bg-background border-r border-border/50",
        theme === "cutesy" && "bg-gradient-to-b from-pink-100 to-purple-100 border-r-2 border-pink-200",
        theme === "anime" && "bg-gradient-to-b from-slate-900 to-purple-900 border-r border-purple-500/30"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center mb-8",
          theme === "minimalist" && "bg-primary text-primary-foreground",
          theme === "cutesy" && "bg-pink-400 text-white",
          theme === "anime" && "bg-gradient-to-br from-pink-500 to-cyan-500 text-white"
        )}>
          <span className="font-display font-bold text-lg">T</span>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                  theme === "minimalist" && (isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"),
                  theme === "cutesy" && (isActive ? "bg-pink-200 text-pink-600" : "text-gray-500 hover:bg-pink-100"),
                  theme === "anime" && (isActive ? "bg-purple-800/50 text-cyan-400" : "text-purple-300 hover:bg-purple-800/30")
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
