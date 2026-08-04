export type BobSettings = {
  displayName: string;
  username: string;
  typingStyle: "casual" | "balanced" | "formal";
  responseLength: "short" | "medium" | "long";
  memoryEnabled: boolean;
};

const KEY = "bobai.settings.v1";

export const defaultSettings: BobSettings = {
  displayName: "bob",
  username: "@bob",
  typingStyle: "casual",
  responseLength: "medium",
  memoryEnabled: true,
};

export function loadSettings(): BobSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;

    return {
      ...defaultSettings,
      ...(JSON.parse(raw) as Partial<BobSettings>),
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: BobSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}