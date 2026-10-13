"use client";

import type { ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  composer: ReactNode;
};

export default function NeuralShell({ sidebar, topbar, children, composer }: Props) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#08090b] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_55%_0%,rgba(56,189,248,0.055),transparent_52%)]" />
      <div className="absolute inset-0 p-0 sm:p-2">
        <div className="relative flex h-full w-full overflow-hidden border border-white/[0.07] bg-[#08090b] sm:rounded-2xl">
          <aside className="relative z-10 hidden w-[260px] shrink-0 border-r border-white/[0.08] bg-[#0a0b0d] sm:block lg:w-[286px]">
            {sidebar}
          </aside>

          <div className="relative z-10 flex min-w-0 flex-1 flex-col bg-[#08090b]">
            <header className="shrink-0 border-b border-white/[0.07] bg-[#08090b] px-2 py-1 sm:px-3">
              {topbar}
            </header>

            <main className="relative min-h-0 flex-1 overflow-hidden">
              {children}
            </main>

            <footer className="relative shrink-0 border-t border-white/[0.07] bg-[#08090b] px-3 py-3 sm:px-6 sm:py-4">
              {composer}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
