"use client";

import PillNav from "@/components/PillNav";

export default function NeuralTopbar() {
  return (
    <header className="h-[72px] px-3 pt-2 pb-2 sm:px-4">
      <div className="flex h-full items-center justify-between rounded-2xl border border-white/[0.07] bg-[#080a0d]/95 px-4 shadow-[0_12px_36px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05]">
            <span className="text-sm font-bold text-cyan-200">B</span>
          </div>
          <div className="leading-tight">
            <div className="text-[16px] font-semibold tracking-tight text-white">Bob AI</div>
            <div className="mt-0.5 text-[11px] text-white/40">Your AI workspace</div>
          </div>
        </div>
        <PillNav items={[{ label: "Chat", href: "/chat" }, { label: "Settings", href: "/settings" }]} />
      </div>
    </header>
  );
}
