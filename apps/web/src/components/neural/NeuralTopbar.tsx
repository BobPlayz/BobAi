"use client";

import {
  Bell,
  Cpu,
  Command,
  Search,
  Sparkles,
  Activity,
  MoreHorizontal,
  Shield,
} from "lucide-react";

export default function NeuralTopbar() {
  return (
    <header className="relative h-[82px] bg-[#05080D]">
      {/* top cyan seam */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-cyan-400/18" />

      {/* subtle inner glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,217,255,0.08),transparent_65%)]" />

      <div className="relative flex h-full items-center justify-between px-6">
        {/* Left cluster */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-cyan-300/20 bg-[#081018] shadow-[0_0_18px_rgba(0,217,255,0.14)]">
            <Cpu className="h-5 w-5 text-cyan-300" />
          </div>

          <div className="leading-tight">
            <div className="text-[18px] font-semibold tracking-tight text-white">
              Bob AI
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cyan-300/70">
              <Activity className="h-3.5 w-3.5" />
              Neural Interface
            </div>
          </div>
        </div>

        {/* Center command/search */}
        <div className="hidden w-[460px] items-center justify-center lg:flex">
          <div className="flex h-11 w-full items-center rounded-[18px] border border-cyan-400/10 bg-[#081018] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <Search className="h-4 w-4 text-cyan-300/45" />
            <input
              readOnly
              value=""
              placeholder="Search memory, conversations, files, tools..."
              className="ml-3 flex-1 bg-transparent text-sm text-white placeholder:text-cyan-300/28 outline-none"
            />
            <div className="flex items-center gap-1 rounded-lg border border-cyan-400/10 bg-[#071018] px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-300/55">
              <Command className="h-3 w-3" />
              K
            </div>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          <button className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/10 bg-[#081018] text-cyan-300/70 transition hover:border-cyan-300/25 hover:text-cyan-100">
            <Sparkles className="h-5 w-5" />
          </button>

          <button className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/10 bg-[#081018] text-cyan-300/70 transition hover:border-cyan-300/25 hover:text-cyan-100">
            <Shield className="h-5 w-5" />
          </button>

          <button className="relative flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/10 bg-[#081018] text-cyan-300/70 transition hover:border-cyan-300/25 hover:text-cyan-100">
            <Bell className="h-5 w-5" />
            <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(0,217,255,0.8)]" />
          </button>

          <button className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/10 bg-[#081018] text-cyan-300/70 transition hover:border-cyan-300/25 hover:text-cyan-100">
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {/* Neural core */}
          <div className="ml-1 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/20 bg-[#081018] shadow-[0_0_18px_rgba(0,217,255,0.14)]">
            <div className="neural-orb">
              <div className="neural-orb-core" />
            </div>
          </div>
        </div>
      </div>

      {/* bottom seam */}
      <div className="pointer-events-none absolute bottom-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />
    </header>
  );
}