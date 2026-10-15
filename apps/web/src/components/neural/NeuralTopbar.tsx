"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function NeuralTopbar() {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <header className="flex h-12 items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="jarvis-reactor-mark" />
        <div>
          <div className={["text-xs font-semibold tracking-[0.24em]", light ? "text-[#155765]" : "text-[#a8e5ee]"].join(" ")}>JARVIS</div>
          <div className={["text-[9px] tracking-[0.16em]", light ? "text-[#527f89]" : "text-[#1b7588]"].join(" ")}>LOCAL ASSISTANT INTERFACE</div>
        </div>
      </div>
      <button type="button" onClick={toggleTheme} aria-label={light ? "Switch to dark mode" : "Switch to light mode"} title={light ? "Switch to dark mode" : "Switch to light mode"} className={["flex h-8 items-center gap-2 border px-3 text-xs", light ? "border-[#82bac5] bg-white/70 text-[#155765] hover:bg-white" : "border-[#087f91]/70 bg-[#06121b] text-[#70eafa] hover:bg-[#0b2530]"].join(" ")}>
        {light ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{light ? "Dark mode" : "Light mode"}</span>
      </button>
    </header>
  );
}
