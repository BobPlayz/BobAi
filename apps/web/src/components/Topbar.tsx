"use client";

import { Search, Bell, Sparkles, PanelLeft } from "lucide-react";

export default function Topbar() {
  return (
    <header className="flex h-[78px] items-center justify-between border-b border-cyan-400/10 bg-[#040A11]/90 px-7 backdrop-blur-2xl">
      <div className="flex items-center gap-4">
        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-[#071018] text-cyan-300 shadow-[0_0_18px_rgba(0,217,255,0.18)] transition hover:border-cyan-300/50 hover:text-cyan-100 hover:shadow-[0_0_26px_rgba(0,217,255,0.38)]">
          <PanelLeft className="h-5 w-5" />
        </button>

        <div className="leading-tight">
          <div className="text-[22px] font-semibold tracking-tight text-[#EAF8FF]">
            Bob AI
          </div>
          <div className="mt-1 text-xs tracking-[0.16em] text-cyan-300/70 uppercase">
            Neural Interface
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-[#071018] text-cyan-300 transition hover:border-cyan-300/45 hover:text-cyan-100 hover:shadow-[0_0_20px_rgba(0,217,255,0.28)]">
          <Search className="h-5 w-5" />
        </button>

        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-[#071018] text-cyan-300 transition hover:border-cyan-300/45 hover:text-cyan-100 hover:shadow-[0_0_20px_rgba(0,217,255,0.28)]">
          <Sparkles className="h-5 w-5" />
        </button>

        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-[#071018] text-cyan-300 transition hover:border-cyan-300/45 hover:text-cyan-100 hover:shadow-[0_0_20px_rgba(0,217,255,0.28)]">
          <Bell className="h-5 w-5" />
        </button>

        <div className="ml-2 h-11 w-11 rounded-full border border-cyan-400/25 bg-[#08131C] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_22px_rgba(0,217,255,0.22)]" />
      </div>
    </header>
  );
}