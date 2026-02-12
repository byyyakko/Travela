import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeStyle = "cutesy";
export type ColorMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeStyle;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem("color-mode");
    return (saved === "dark" ? "dark" : "light") as ColorMode;
  });

  useEffect(() => {
    // Apply cutesy theme class to body
    document.body.classList.remove("theme-minimalist", "theme-cutesy", "theme-anime");
    document.body.classList.add("theme-cutesy");
  }, []);

  useEffect(() => {
    localStorage.setItem("color-mode", colorMode);
    if (colorMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [colorMode]);

  return (
    <ThemeContext.Provider value={{ theme: "cutesy", colorMode, setColorMode }}>
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
