"use client";

import type { ReactNode } from "react";
import NeuralScene from "./NeuralScene";
import { SceneEngine } from "./SceneEngine";
import { ThemeProvider } from "./ThemeProvider";

type Props = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  composer: ReactNode;
};

export default function NeuralShell({
  sidebar,
  topbar,
  children,
  composer,
}: Props) {
  return (
    <ThemeProvider>
      <SceneEngine>
        <div className="relative h-screen w-screen overflow-hidden bg-[#02050A]">
          <NeuralScene />

          <div className="absolute inset-0 p-2">
            <div className="relative flex h-full w-full overflow-hidden rounded-[30px] border border-cyan-400/12 bg-[#05080D]/62 shadow-[0_0_0_1px_rgba(0,217,255,0.05),0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-3xl">
              <div className="pointer-events-none absolute inset-0 rounded-[30px] border border-white/5" />
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />

              <div className="w-[300px] border-r border-cyan-400/10 bg-[#04070C]/72 backdrop-blur-2xl">
                {sidebar}
              </div>

              <div className="flex flex-1 flex-col bg-[#05080D]/48">
                <div className="border-b border-cyan-400/10 bg-[#05080D]/58 px-4 py-3 backdrop-blur-2xl">
                  {topbar}
                </div>

                <div className="relative flex-1 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,217,255,0.05),transparent_70%)]" />
                  {children}
                </div>

                <div className="border-t border-cyan-400/10 bg-[#04070C]/60 px-6 py-4 backdrop-blur-2xl">
                  {composer}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SceneEngine>
    </ThemeProvider>
  );
}