"use client";

import type { ReactNode } from "react";
import { useTheme } from "./ThemeProvider";

type Props = { sidebar: ReactNode; topbar: ReactNode; children: ReactNode; composer: ReactNode };

export default function NeuralShell({ sidebar, topbar, children, composer }: Props) {
  const { theme } = useTheme();
  const light = theme === "light";
  return (
    <div className={["relative h-screen w-screen overflow-hidden", light ? "bg-[#f7f8fa] text-[#202123]" : "bg-[#08090b] text-white"].join(" ")}>
      <div className={["absolute inset-0 p-0 sm:p-2", light ? "bg-[#f7f8fa]" : "bg-[#08090b]"].join(" ")}>
        <div className={["relative flex h-full w-full overflow-hidden border sm:rounded-2xl", light ? "border-[#e5e7eb] bg-white" : "border-white/[0.07] bg-[#08090b]"].join(" ")}>
          <aside className={["relative z-10 hidden w-[260px] shrink-0 border-r sm:block lg:w-[286px]", light ? "border-[#e5e7eb] bg-[#f1f2f4]" : "border-white/[0.08] bg-[#0a0b0d]"].join(" ")}>
            {sidebar}
          </aside>
          <div className={["relative z-10 flex min-w-0 flex-1 flex-col", light ? "bg-white" : "bg-[#08090b]"].join(" ")}>
            <header className={["shrink-0 border-b px-2 py-1 sm:px-3", light ? "border-[#e5e7eb] bg-white" : "border-white/[0.07] bg-[#08090b]"].join(" ")}>{topbar}</header>
            <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
            <footer className={["relative shrink-0 border-t px-3 py-3 sm:px-6 sm:py-4", light ? "border-[#e5e7eb] bg-white" : "border-white/[0.07] bg-[#08090b]"].join(" ")}>{composer}</footer>
          </div>
        </div>
      </div>
    </div>
  );
}
