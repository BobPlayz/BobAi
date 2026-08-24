"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<BobTheme>(() => {
    if (typeof window === "undefined") return "legacy";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "legacy" || stored === "dark" || stored === "light" || stored === "futuristic" || stored === "anime" || stored === "glass" ? stored : "legacy";
  });
  const [accent, setAccent] = useState(() => {
    if (typeof window === "undefined") return "#38bdf8";
    const stored = localStorage.getItem(ACCENT_KEY);
    return stored && /^#[0-9a-f]{6}$/i.test(stored) ? stored : "#38bdf8";
  });

  useEffect(() => {
    return undefined;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-2", accent);
    localStorage.setItem(STORAGE_KEY, theme);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent, theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme: setThemeState,
      accent,
      setAccent,
      cycleTheme: () => {
        setThemeState((current) => {
          const order: BobTheme[] = [
            "legacy",
            "dark",
            "light",
            "futuristic",
            "anime",
            "glass",
          ];

          const index = order.indexOf(current);

          return order[(index + 1) % order.length];
        });
      },
    }),
    [accent, theme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}