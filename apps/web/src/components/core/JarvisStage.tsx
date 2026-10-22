"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAssistantState, type AssistantVisualState } from "@/lib/assistantState";
import type { CoreQuality } from "./JarvisCoreScene";
import { useTheme } from "@/components/neural/ThemeProvider";

// three.js and the scene only load in the browser, after first paint, so they never block the chat UI.
const JarvisCoreScene = dynamic(() => import("./JarvisCoreScene"), { ssr: false, loading: () => <ReactorFallback /> });

const STATE_LABEL: Record<AssistantVisualState, string> = { idle: "At rest", listening: "Listening", thinking: "Thinking", speaking: "Speaking" };
const QUALITY_ORDER: CoreQuality[] = ["low", "medium", "high"];

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch { return false; }
}

/** Starting quality from cheap hardware hints; the frame-rate monitor corrects it at runtime. */
function initialQuality(): CoreQuality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
  if (mobile || (nav.hardwareConcurrency || 4) <= 4) return "low";
  let renderer = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  } catch { /* hint unavailable */ }
  // Integrated Intel graphics (for example UHD 620) and 8 GB machines start at medium.
  if (/intel|uhd|hd graphics|iris|swiftshader|llvmpipe|software/i.test(renderer) || (nav.deviceMemory ?? 8) <= 8) return "medium";
  return "high";
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function ReactorFallback() {
  return (
    <div className="jarvis-reactor" role="img" aria-label="Jarvis core">
      <i className="jarvis-reactor-ring jarvis-reactor-ring-one" />
      <i className="jarvis-reactor-ring jarvis-reactor-ring-two" />
      <i className="jarvis-reactor-ring jarvis-reactor-ring-three" />
      <i className="jarvis-reactor-orbit" />
      <i className="jarvis-reactor-core" />
    </div>
  );
}

/** compact: docked corner orb in the workspace. hero: inline figure (landing page) whose state can be set directly. */
export default function JarvisStage({ compact = false, hero = false, stateOverride, label }: { compact?: boolean; hero?: boolean; stateOverride?: AssistantVisualState; label?: string }) {
  const liveState = useAssistantState();
  const state = stateOverride ?? liveState;
  const { theme } = useTheme();
  const [mode, setMode] = useState<"pending" | "webgl" | "fallback">("pending");
  const [quality, setQuality] = useState<CoreQuality>("medium");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  // On phones the docked orb would cover messages; skip it entirely (no WebGL context either).
  const [narrow, setNarrow] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const lowFrames = useRef(0);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(motion.matches);
    sync();
    motion.addEventListener("change", sync);
    setQuality(initialQuality());
    const narrowQuery = window.matchMedia("(max-width: 640px)");
    const syncNarrow = () => setNarrow(narrowQuery.matches);
    syncNarrow();
    narrowQuery.addEventListener("change", syncNarrow);
    setMode(webglAvailable() ? "webgl" : "fallback");
    // Stop rendering entirely while the tab is hidden.
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => { motion.removeEventListener("change", sync); narrowQuery.removeEventListener("change", syncNarrow); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const onFps = useCallback((fps: number) => {
    container.current?.setAttribute("data-fps", fps.toFixed(1));
    // Three consecutive seconds under 40 fps steps down one quality tier.
    lowFrames.current = fps < 40 ? lowFrames.current + 1 : 0;
    if (lowFrames.current >= 3) {
      lowFrames.current = 0;
      setQuality((current) => QUALITY_ORDER[Math.max(0, QUALITY_ORDER.indexOf(current) - 1)]);
    }
  }, []);

  if (compact && narrow) return null;

  return (
    <div
      ref={container}
      className={`jarvis-stage ${compact ? "jarvis-stage-compact" : ""} ${hero ? "jarvis-stage-hero" : ""}`}
      data-state={state}
      data-quality={quality}
      data-renderer={mode}
    >
      <div className="jarvis-stage-canvas">
        {mode === "webgl" && visible ? (
          <SceneBoundary fallback={<ReactorFallback />}>
            <JarvisCoreScene key={quality} state={state} quality={quality} theme={theme} reducedMotion={reducedMotion} onFps={onFps} />
          </SceneBoundary>
        ) : mode === "fallback" ? <ReactorFallback /> : null}
      </div>
      <p className="jarvis-stage-label" role="status" aria-live="polite">
        <span className="jarvis-stage-dot" aria-hidden />
        {label ?? STATE_LABEL[state]}
      </p>
    </div>
  );
}
