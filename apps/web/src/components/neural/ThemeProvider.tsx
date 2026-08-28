"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type BobTheme =
  | "legacy"
  | "dark"
  | "light"
  | "futuristic"
  | "anime"
  | "glass";

type ThemeContextType = {
  theme: BobTheme;
  setTheme: (theme: BobTheme) => void;
  accent: string;
  setAccent: (accent: string) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);
const STORAGE_KEY = "bobai-theme";
const ACCENT_KEY = "bobai-accent";
const THEMES: BobTheme[] = ["legacy", "dark", "light", "futuristic", "anime", "glass"];
const isTheme = (value: string | null): value is BobTheme => value !== null && THEMES.includes(value as BobTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Keep the first render deterministic on both server and client. Browser storage
  // is read only after hydration so persisted themes cannot change the SSR tree.
  const [theme, setThemeState] = useState<BobTheme>("legacy");
  const [accent, setAccentState] = useState("#38bdf8");

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    const storedAccent = localStorage.getItem(ACCENT_KEY);
    if (isTheme(storedTheme)) setThemeState(storedTheme);
    if (storedAccent && /^#[0-9a-f]{6}$/i.test(storedAccent)) setAccentState(storedAccent);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-2", accent);
    localStorage.setItem(STORAGE_KEY, theme);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent, theme]);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    setTheme: setThemeState,
    accent,
    setAccent: setAccentState,
    cycleTheme: () => setThemeState((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]),
  }), [accent, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
