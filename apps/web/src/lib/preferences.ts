/**
 * Chat preferences shared by the settings page, onboarding and the chat. One storage key for all of them;
 * preferences saved under the old key are read once so nobody loses what they set before.
 */
import { isGenerationId } from "./generation";

export const PREFERENCES_KEY = "jarvis.settings.v1";
const LEGACY_KEY = "bobai.settings.v1";

export type Preferences = { personality: string; memory: boolean; sourceTypes: string[]; generation: string; learnStyle: boolean };
const DEFAULTS: Preferences = { personality: "", memory: true, sourceTypes: ["general"], generation: "", learnStyle: true };

export function loadPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY) ?? window.localStorage.getItem(LEGACY_KEY) ?? "{}";
    const value = JSON.parse(raw) as Partial<Preferences>;
    return {
      personality: typeof value.personality === "string" ? value.personality.slice(0, 12_000) : DEFAULTS.personality,
      memory: value.memory !== false,
      sourceTypes: Array.isArray(value.sourceTypes) && value.sourceTypes.every((item) => typeof item === "string") ? value.sourceTypes : DEFAULTS.sourceTypes,
      generation: isGenerationId(value.generation) ? value.generation : "",
      learnStyle: value.learnStyle !== false,
    };
  } catch { return DEFAULTS; }
}

export function savePreferences(next: Partial<Preferences>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...loadPreferences(), ...next })); } catch { /* storage unavailable */ }
}
