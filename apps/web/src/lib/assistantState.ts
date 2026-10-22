"use client";

import { useSyncExternalStore } from "react";

/**
 * What the Jarvis core visual should show. Several sources can be active at once (for example a reply is
 * streaming while text-to-speech plays), so each source sets its own flag and the visible state is derived
 * with a fixed priority: listening > speaking > thinking > idle.
 */
export type AssistantVisualState = "idle" | "listening" | "thinking" | "speaking";
type Source = "voice-input" | "voice-output" | "request" | "stream";

const active = new Set<Source>();
const listeners = new Set<() => void>();
let snapshot: AssistantVisualState = "idle";

function derive(): AssistantVisualState {
  if (active.has("voice-input")) return "listening";
  if (active.has("voice-output") || active.has("stream")) return "speaking";
  if (active.has("request")) return "thinking";
  return "idle";
}

export function setAssistantActivity(source: Source, on: boolean) {
  if (on) active.add(source); else active.delete(source);
  const next = derive();
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAssistantState(): AssistantVisualState {
  return useSyncExternalStore(subscribe, () => snapshot, () => "idle");
}
