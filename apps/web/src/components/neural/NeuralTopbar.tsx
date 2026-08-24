"use client";

import { useTheme } from "./ThemeProvider";
import PillNav from "@/components/PillNav";

export default function NeuralTopbar() {
  const { theme } = useTheme();

  return (
    <header className="h-[84px] px-4 pt-3 pb-2">
      <div className="flex h-full items-center justify-between rounded-[22px] border border-cyan-400/10 bg-[#060B10]/94 px-5 shadow-[0_0_0_1px_rgba(0,217,255,0.06),0_18px_56px_rgba(0,0,0,0.46)] backdrop-blur-3xl">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-cyan-300/16 bg-[#071018] shadow-[0_0_16px_rgba(0,217,255,0.12)]">
            <div className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(0,217,255,0.8)]" />
          </div>

          <div className="leading-tight">
            <div className="text-[18px] font-semibold tracking-tight text-white">
              Bob AI
            </div>
            <div className="text-[11px] text-cyan-300/58">
              {theme}
            </div>
          </div>
        </div>

        <PillNav items={[{ label: "Chat", href: "/chat" }, { label: "Settings", href: "/settings" }]} />
      </div>
    </header>
  );
}