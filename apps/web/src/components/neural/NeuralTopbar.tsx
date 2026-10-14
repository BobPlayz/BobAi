"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function NeuralTopbar() {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <header className={["flex h-14 items-center justify-between px-3 sm:px-4", light ? "bg-white" : "bg-[#08090b]"].join(" ")}>
      <div className="flex items-center gap-2">
        <div className={["flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-semibold", light ? "border-[#e5e7eb] bg-[#f8fafc] text-[#0f766e]" : "border-white/10 bg-white/[0.04] text-cyan-200"].join(" ")}>B</div>
        <span className={["text-sm font-semibold", light ? "text-[#202123]" : "text-white"].join(" ")}>Jarvis</span>
      </div>
      <button type="button" onClick={toggleTheme} aria-label={light ? "Switch to dark mode" : "Switch to light mode"} title={light ? "Switch to dark mode" : "Switch to light mode"} className={["flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition", light ? "border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f3f4f6]" : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"].join(" ")}>
        {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        <span className="hidden sm:inline">{light ? "Dark mode" : "Light mode"}</span>
      </button>
    </header>
  );
}
