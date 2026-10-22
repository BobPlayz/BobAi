"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type BobTheme = "dark" | "light";

type ThemeContextType = {
  theme: BobTheme;
  setTheme: (theme: BobTheme) => void;
  toggleTheme: () => void;
  accent: string;
  setAccent: (accent: string) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);
// New key: preferences saved for the old neon theme should not carry over to the editorial redesign.
const THEME_KEY = "jarvis.theme";
const FIXED_ACCENT = "#38bdf8";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<BobTheme>("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setThemeState(saved);
    } catch {
      // Keep the default theme when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme still works for this session when storage is unavailable.
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme: BobTheme) => setThemeState(nextTheme), []);
  const toggleTheme = useCallback(() => setThemeState((current) => current === "dark" ? "light" : "dark"), []);
  const value = useMemo<ThemeContextType>(() => ({
    theme,
    setTheme,
    toggleTheme,
    accent: FIXED_ACCENT,
    setAccent: () => undefined,
    cycleTheme: toggleTheme,
  }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
