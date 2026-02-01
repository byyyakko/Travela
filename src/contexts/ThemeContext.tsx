import { createContext, useContext, useEffect, ReactNode } from "react";

export type ThemeStyle = "cutesy";

interface ThemeContextType {
  theme: ThemeStyle;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    // Apply cutesy theme class to body
    document.body.classList.remove("theme-minimalist", "theme-cutesy", "theme-anime");
    document.body.classList.add("theme-cutesy");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "cutesy" }}>
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
