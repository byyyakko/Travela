import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type ThemeStyle = "minimalist" | "cutesy" | "anime";

interface ThemeContextType {
  theme: ThemeStyle;
  setTheme: (theme: ThemeStyle) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeStyle>("minimalist");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchTheme = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("theme")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data?.theme) {
          setThemeState(data.theme as ThemeStyle);
        }
      }
      setLoading(false);
    };

    fetchTheme();
  }, [user]);

  useEffect(() => {
    // Apply theme class to body
    document.body.classList.remove("theme-minimalist", "theme-cutesy", "theme-anime");
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = async (newTheme: ThemeStyle) => {
    setThemeState(newTheme);
    
    if (user) {
      await supabase
        .from("profiles")
        .update({ theme: newTheme })
        .eq("user_id", user.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
