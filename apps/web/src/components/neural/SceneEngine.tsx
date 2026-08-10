"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTheme } from "./ThemeProvider";

export type SceneState =
  | "boot"
  | "robot-enter"
  | "robot-walk"
  | "robot-charge"
  | "robot-dissolve"
  | "anime-intro"
  | "interface-online";

type SceneContextType = {
  state: SceneState;
  playIntro: () => void;
  skipIntro: () => void;
};

const SceneContext = createContext<SceneContextType | null>(null);

export function SceneEngine({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const [state, setState] = useState<SceneState>("boot");

  useEffect(() => {
    playIntro();
  }, [theme]);

  function playIntro() {
    if (theme === "futuristic") {
      setState("boot");

      setTimeout(() => setState("robot-enter"), 200);
      setTimeout(() => setState("robot-walk"), 900);
      setTimeout(() => setState("robot-charge"), 2600);
      setTimeout(() => setState("robot-dissolve"), 3800);
      setTimeout(() => setState("interface-online"), 4800);

      return;
    }

    if (theme === "anime") {
      setState("anime-intro");
      setTimeout(() => setState("interface-online"), 3200);
      return;
    }

    setState("interface-online");
  }

  const value = useMemo(
    () => ({
      state,
      playIntro,
      skipIntro: () => setState("interface-online"),
    }),
    [state]
  );

  return (
    <SceneContext.Provider value={value}>
      <div
        className={
          state === "interface-online"
            ? "relative h-full w-full"
            : "relative h-full w-full overflow-hidden"
        }
      >
        {children}

        {/* Boot fade */}
        {state === "boot" && (
          <div className="pointer-events-none absolute inset-0 z-40 bg-[#02050A] animate-[bootFade_400ms_ease-out_forwards]" />
        )}

        {/* Global activation glow */}
        {state !== "interface-online" && (
          <div className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(circle_at_center,rgba(0,217,255,0.08),transparent_70%)]" />
        )}

        {/* Anime intro overlay */}
        {state === "anime-intro" && (
          <div className="pointer-events-none absolute inset-0 z-35">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.18),transparent_70%)] animate-[animeFlash_900ms_ease-in-out_infinite]" />
            <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-300 to-transparent opacity-70 animate-[slashOpen_1.8s_ease-out_forwards]" />
          </div>
        )}

        <style jsx global>{`
          @keyframes bootFade {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }

          @keyframes animeFlash {
            0%,
            100% {
              opacity: 0.2;
            }
            50% {
              opacity: 0.8;
            }
          }

          @keyframes slashOpen {
            0% {
              transform: translateX(-50%) scaleY(0);
              opacity: 0;
            }
            30% {
              transform: translateX(-50%) scaleY(1);
              opacity: 1;
            }
            100% {
              transform: translateX(-50%) scaleY(1);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    </SceneContext.Provider>
  );
}

export function useScene() {
  const context = useContext(SceneContext);

  if (!context) {
    throw new Error(
      "useScene must be used inside SceneEngine"
    );
  }

  return context;
}