"use client";

import Link from "next/link";

export default function Topbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[#232B36] bg-[#10161D] px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171D26]">
          <span className="text-sm font-black text-[#38BDF8]">B</span>
        </div>

        <div className="leading-tight">
          <div className="text-sm font-semibold text-[#E5EEF7]">
            Bob AI
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#94A3B8]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#38BDF8]" />
            Online
            <span className="text-[#475569]">•</span>
            Local model
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="rounded-lg border border-[#232B36] bg-[#141A22] px-3 py-1.5 text-xs text-[#E5EEF7] transition hover:border-[#38BDF8] hover:text-[#38BDF8]">
          New Chat
        </button>

        <Link
          href="/settings"
          className="rounded-lg border border-[#232B36] bg-[#141A22] px-3 py-1.5 text-xs text-[#E5EEF7] transition hover:border-[#38BDF8] hover:text-[#38BDF8]"
        >
          Settings
        </Link>
      </div>
    </header>
  );
}