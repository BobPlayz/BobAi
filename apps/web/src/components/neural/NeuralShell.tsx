"use client";

import type { ReactNode } from "react";
import { useTheme } from "./ThemeProvider";
import NeuralScene from "./NeuralScene";
import { SceneEngine } from "./SceneEngine";

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
  const { theme } = useTheme();

  const isImmersive =
    theme === "futuristic" || theme === "anime";

  return (
    <SceneEngine>
      <div
        className={[
          "relative h-screen w-screen overflow-hidden",
          theme === "light"
            ? "bg-[#F5F7FA] text-[#111827]"
            : "bg-[#02050A] text-white",
        ].join(" ")}
      >
        {/* 3d cinematic background */}
        {isImmersive && <NeuralScene />}

        {/* subtle background for normal themes */}
        {!isImmersive && (
          <div
            className={
              theme === "light"
                ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.06),transparent_65%)]"
                : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.035),transparent_65%)]"
            }
          />
        )}

        {/* application frame */}
        <div className="absolute inset-0 p-2 sm:p-3">
          <div
            className={[
              "relative flex h-full w-full overflow-hidden rounded-[28px] sm:rounded-[30px]",
              "border backdrop-blur-3xl",
              theme === "light"
                ? "border-black/10 bg-white/75 shadow-[0_30px_100px_rgba(15,23,42,0.12)]"
                : "border-cyan-400/10 bg-[#05080D]/65 shadow-[0_0_0_1px_rgba(0,217,255,0.04),0_40px_120px_rgba(0,0,0,0.55)]",
            ].join(" ")}
          >
            {/* glass highlight */}
            <div
              className={[
                "pointer-events-none absolute inset-0 rounded-[28px] sm:rounded-[30px]",
                "border",
                theme === "light"
                  ? "border-white/70"
                  : "border-white/5",
              ].join(" ")}
            />

            {/* top cinematic line */}
            {theme === "futuristic" && (
              <div className="pointer-events-none absolute inset-x-10 top-0 z-20 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            )}

            {/* sidebar */}
            <aside
              className={[
                "relative z-10 hidden w-[280px] shrink-0 border-r md:block lg:w-[300px]",
                theme === "light"
                  ? "border-black/8 bg-white/60"
                  : "border-cyan-400/10 bg-[#04070C]/70",
              ].join(" ")}
            >
              {sidebar}
            </aside>

            {/* main application */}
            <div
              className={[
                "relative z-10 flex min-w-0 flex-1 flex-col",
                theme === "light"
                  ? "bg-white/35"
                  : "bg-[#05080D]/45",
              ].join(" ")}
            >
              {/* topbar */}
              <header
                className={[
                  "shrink-0 border-b px-3 py-2 sm:px-4 sm:py-3",
                  theme === "light"
                    ? "border-black/8 bg-white/55"
                    : "border-cyan-400/10 bg-[#05080D]/55",
                ].join(" ")}
              >
                {topbar}
              </header>

              {/* chat/content */}
              <main className="relative min-h-0 flex-1 overflow-hidden">
                <div
                  className={
                    theme === "futuristic"
                      ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,217,255,0.045),transparent_70%)]"
                      : theme === "anime"
                      ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.06),transparent_70%)]"
                      : "pointer-events-none absolute inset-0"
                  }
                />

                <div className="relative h-full">
                  {children}
                </div>
              </main>

              {/* composer */}
              <footer
                className={[
                  "relative shrink-0 border-t px-3 py-3 sm:px-6 sm:py-4",
                  theme === "light"
                    ? "border-black/8 bg-white/60"
                    : "border-cyan-400/10 bg-[#04070C]/60",
                ].join(" ")}
              >
                {composer}
              </footer>
            </div>
          </div>
        </div>
      </div>
    </SceneEngine>
  );
}