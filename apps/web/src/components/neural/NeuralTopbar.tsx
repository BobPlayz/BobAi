"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function NeuralTopbar({ caption = "Your workspace" }: { caption?: string }) {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-4">
        <Link href="/" className="atelier-wordmark" aria-label="Jarvis home">Jarvis<em>.</em></Link>
        <span className="caption hidden truncate sm:inline">{caption}</span>
      </div>
      <button type="button" onClick={toggleTheme} className="atelier-iconbtn" aria-label={light ? "Switch to ink (dark) theme" : "Switch to paper (light) theme"} title={light ? "Ink theme" : "Paper theme"}>
        {light ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
