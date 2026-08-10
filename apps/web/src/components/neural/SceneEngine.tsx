"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTheme } from "./ThemeProvider";

export type SceneState =
  | "idle"
  | "intro-loading"
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
  const [state, setState] =
    useState<SceneState>("intro-loading");

  useEffect(() => {
    play();
  }, [theme]);

  function play() {
    if (theme === "futuristic") {
      setState("robot-enter");

      setTimeout(() => {
        setState("robot-walk");
      }, 500);

      setTimeout(() => {
        setState("robot-charge");
      }, 2200);

      setTimeout(() => {
        setState("robot-dissolve");
      }, 3400);

      setTimeout(() => {
        setState("interface-online");
      }, 4400);
    } else if (theme === "anime") {
      setState("anime-intro");

      setTimeout(() => {
        setState("interface-online");
      }, 3200);
    } else {
      setState("interface-online");
    }
  }

  const value = useMemo(
    () => ({
      state,
      playIntro: play,
      skipIntro: () => setState("interface-online"),
    }),
    [state]
  );

  return (
    <SceneContext.Provider value={value}>
      <div className="relative h-full w-full">
        {children}

        {/* Global activation overlay */}
        {state !== "interface-online" && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,217,255,0.12),transparent_70%)]" />
          </div>
        )}

        {/* Robot placeholder layer */}
        {(state === "robot-enter" ||
          state === "robot-walk" ||
          state === "robot-charge" ||
          state === "robot-dissolve") && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={
                state === "robot-enter"
                  ? "h-28 w-14 rounded-xl border border-cyan-300/30 bg-[#0A1622] opacity-0 animate-[fadeIn_500ms_forwards]"
                  : state === "robot-walk"
                  ? "h-28 w-14 rounded-xl border border-cyan-300/30 bg-[#0A1622] animate-[robotWalk_1.7s_linear_forwards]"
                  : state === "robot-charge"
                  ? "h-28 w-14 rounded-xl border border-cyan-300/30 bg-[#0A1622] shadow-[0_0_28px_rgba(0,217,255,0.45)] animate-[chargePulse_1.2s_ease-in-out_infinite]"
                  : "h-28 w-14 rounded-xl border border-cyan-300/30 bg-[#0A1622] animate-[dissolve_1s_ease-out_forwards]"
              }
            />
          </div>
        )}

        {/* Anime placeholder layer */}
        {state === "anime-intro" && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.18),transparent_70%)] animate-[animeFlash_900ms_ease-in-out_infinite]" />
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(140px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes robotWalk {
          from {
            transform: translateX(180px);
          }
          to {
            transform: translateX(-180px);
          }
        }

        @keyframes chargePulse {
          0%,
          100% {
            box-shadow: 0 0 12px rgba(0, 217, 255, 0.25);
          }
          50% {
            box-shadow: 0 0 40px rgba(0, 217, 255, 0.55);
          }
        }

        @keyframes dissolve {
          to {
            opacity: 0;
            transform: scale(0.8);
            filter: blur(12px);
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
      `}</style>
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