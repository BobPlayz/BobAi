"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type BobTheme =
  | "dark"
  | "light"
  | "futuristic"
  | "anime";

type ThemeContextType = {
  theme: BobTheme;
  setTheme: (theme: BobTheme) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "bobai-theme";

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] =
    useState<BobTheme>("futuristic");

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;

    if (
      stored === "dark" ||
      stored === "light" ||
      stored === "futuristic" ||
      stored === "anime"
    ) {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme: setThemeState,
      cycleTheme: () => {
        setThemeState((current) => {
          const order: BobTheme[] = [
            "dark",
            "light",
            "futuristic",
            "anime",
          ];

          const index = order.indexOf(current);

          return order[(index + 1) % order.length];
        });
      },
    }),
    [theme]
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