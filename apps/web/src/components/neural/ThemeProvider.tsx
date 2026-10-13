"use client";

import { createContext, useContext, useMemo } from "react";

export type BobTheme = "dark";

type ThemeContextType = {
  theme: BobTheme;
  setTheme: (theme: BobTheme) => void;
  accent: string;
  setAccent: (accent: string) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);
const FIXED_ACCENT = "#38bdf8";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<ThemeContextType>(() => ({
    theme: "dark",
    setTheme: () => undefined,
    accent: FIXED_ACCENT,
    setAccent: () => undefined,
    cycleTheme: () => undefined,
  }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
