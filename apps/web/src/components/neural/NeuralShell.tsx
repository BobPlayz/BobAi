"use client";

import type { ReactNode } from "react";
import { useTheme } from "./ThemeProvider";

type Props = { sidebar: ReactNode; topbar: ReactNode; children: ReactNode; composer: ReactNode };

export default function NeuralShell({ sidebar, topbar, children, composer }: Props) {
  const { theme } = useTheme();
  const light = theme === "light";
  return (
    <div className={["jarvis-glass-shell relative h-[100dvh] min-h-[100dvh] w-screen overflow-hidden", light ? "jarvis-glass-light" : "jarvis-glass-dark"].join(" ")}>
      <i aria-hidden="true" className="jarvis-corner jarvis-corner-tl" />
      <i aria-hidden="true" className="jarvis-corner jarvis-corner-tr" />
      <i aria-hidden="true" className="jarvis-corner jarvis-corner-bl" />
      <i aria-hidden="true" className="jarvis-corner jarvis-corner-br" />
      <div className="jarvis-glass-frame relative flex h-full w-full overflow-hidden">
        <aside className="jarvis-glass-sidebar relative z-10 hidden w-[250px] shrink-0 sm:block lg:w-[278px]">{sidebar}</aside>
        <div className="jarvis-glass-main relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="jarvis-glass-topbar shrink-0">{topbar}</header>
          <div className="jarvis-glass-brandline" aria-hidden="true">
            <span>J · A · R · V · I · S</span>
            <small>JUST A RATHER VERY INTELLIGENT SYSTEM</small>
          </div>
          <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
          <footer className="jarvis-glass-composer shrink-0">{composer}</footer>
        </div>
      </div>
    </div>
  );
}
