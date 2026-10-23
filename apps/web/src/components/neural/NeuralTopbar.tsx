"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import JarvisMark from "@/components/JarvisMark";

export default function NeuralTopbar({ caption = "Your workspace" }: { caption?: string }) {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/" className="atelier-wordmark" aria-label="Jarvis home"><JarvisMark />Jarvis</Link>
        {/* The chat title updates live: "New chat" until the first reply, then the AI-written title. */}
        <span className="min-w-0 truncate text-sm text-[var(--muted)]" title={caption} aria-live="polite">{caption}</span>
      </div>
      <button type="button" onClick={toggleTheme} className="atelier-iconbtn" aria-label={light ? "Switch to night theme" : "Switch to day theme"} title={light ? "Night theme" : "Day theme"}>
        {light ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
