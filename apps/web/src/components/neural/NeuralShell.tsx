"use client";

import type { ReactNode } from "react";
import NeuralScene from "./NeuralScene";
import { SceneEngine } from "./SceneEngine";
import { ThemeProvider } from "./ThemeProvider";

type NeuralShellProps = {
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
}: NeuralShellProps) {
  return (
    <ThemeProvider>
      <SceneEngine>
        <div className="relative h-screen w-screen overflow-hidden bg-[#02050A]">
          {/* 3D scene behind everything */}
          <NeuralScene />

          {/* UI layer */}
          <div className="relative z-10 flex h-full w-full p-3">
            <div className="relative flex h-full w-full overflow-hidden rounded-[42px] border border-cyan-400/20 bg-[#05080D]/92 shadow-[0_0_0_1px_rgba(0,217,255,0.08),0_0_60px_rgba(0,217,255,0.18)] backdrop-blur-3xl">
              {/* Left sidebar */}
              <div className="w-[308px] border-r border-cyan-400/10 bg-[#04070C]/90">
                {sidebar}
              </div>

              {/* Main area */}
              <div className="flex flex-1 flex-col bg-[#05080D]/75">
                <div className="border-b border-cyan-400/10 bg-[#05080D]/85 px-4 pt-3 pb-2">
                  {topbar}
                </div>

                <div className="flex-1 overflow-hidden">
                  {children}
                </div>

                <div className="border-t border-cyan-400/10 bg-[#04070C]/85 px-6 pt-4 pb-5">
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