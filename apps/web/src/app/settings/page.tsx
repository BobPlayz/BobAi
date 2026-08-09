"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SETTINGS_KEY = "bobai.settings.v1";

type Tab =
  | "account"
  | "personalization"
  | "appearance"
  | "privacy"
  | "memory"
  | "about";

interface SettingsState {
  personality: string;
  nsfw: boolean;
  memory: boolean;
  theme: "dark" | "system";
  accent: "sky";
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("personalization");

  const [settings, setSettings] = useState<SettingsState>({
    personality: "",
    nsfw: false,
    memory: true,
    theme: "dark",
    accent: "sky",
  });

  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);

      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<SettingsState>;

      setSettings((prev) => ({
        ...prev,
        ...parsed,
      }));
    } catch {}
  }, []);

  function update<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));

    setDirty(true);
  }

  function save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    setDirty(false);

    setTimeout(() => setSaved(false), 1500);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "personalization", label: "Personalization" },
    { id: "appearance", label: "Appearance" },
    { id: "privacy", label: "Privacy" },
    { id: "memory", label: "Memory" },
    { id: "about", label: "About" },
  ];

  return (
    <main className="min-h-screen bg-[#0B0F14] text-[#E5EEF7]">
      <div className="mx-auto flex min-h-screen max-w-[1200px]">
        <aside className="w-64 border-r border-[#2A3340] bg-[#10161D] p-5">
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-[#171D26]">
              <div className="absolute inset-0 rounded-2xl bg-[#38BDF8]/10 blur-lg" />
              <span className="relative text-lg font-black text-[#38BDF8]">
                B
              </span>
            </div>

            <div>
              <div className="text-lg font-semibold text-[#E5EEF7]">
                Bob AI
              </div>
              <div className="text-xs text-[#94A3B8]">
                Workspace settings
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? "w-full rounded-2xl border border-[#38BDF8]/30 bg-[#171D26] px-3 py-2 text-left text-sm font-medium text-[#E5EEF7] transition-all duration-200"
                    : "w-full rounded-2xl px-3 py-2 text-left text-sm text-[#94A3B8] transition-all duration-200 hover:bg-[#141A22] hover:text-[#E5EEF7]"
                }
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1 p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold capitalize text-[#E5EEF7]">
                {tab}
              </h1>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Configure how Bob AI works for you
              </p>
            </div>

            <Link
              href="/chat"
              className="rounded-2xl border border-[#2A3340] bg-[#141A22] px-4 py-2 text-sm text-[#E5EEF7] transition-all duration-200 hover:border-[#38BDF8] hover:text-[#38BDF8]"
            >
              ← Back to Chat
            </Link>
          </div>

          {tab === "account" && (
            <div className="rounded-3xl border border-[#2A3340] bg-[#10161D] p-6">
              <div className="text-lg font-semibold text-[#E5EEF7]">
                Account
              </div>
              <div className="mt-2 text-sm text-[#94A3B8]">
                Signed in as <span className="text-[#E5EEF7]">bob</span>
              </div>

              <div className="mt-6 space-y-3">
                <button className="w-full rounded-2xl border border-[#2A3340] bg-[#141A22] px-4 py-3 text-left text-sm text-[#E5EEF7] transition-all duration-200 hover:border-[#38BDF8]">
                  Manage account
                </button>

                <button className="w-full rounded-2xl border border-[#2A3340] bg-[#141A22] px-4 py-3 text-left text-sm text-red-400 transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10">
                  Sign out
                </button>
              </div>
            </div>
          )}

          {tab === "personalization" && (
            <div className="rounded-3xl border border-[#2A3340] bg-[#10161D] p-6">
              <div className="text-lg font-semibold text-[#E5EEF7]">
                Personality
              </div>
              <div className="mt-1 text-sm text-[#94A3B8]">
                Tell Bob AI exactly how you want it to respond.
              </div>

              <textarea
                value={settings.personality}
                onChange={(e) =>
                  update("personality", e.target.value)
                }
                placeholder="talk like me, use lowercase, keep replies short, roast me back, don't sound like chatgpt..."
                className="mt-4 h-56 w-full resize-none rounded-3xl border border-[#2A3340] bg-[#141A22] px-4 py-4 text-[15px] text-[#E5EEF7] outline-none transition-all duration-200 placeholder:text-[#64748B] focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/10"
              />

              <div className="mt-3 text-xs text-[#64748B]">
                This will be injected into Bob AI's system prompt and affect future conversations.
              </div>
            </div>
          )}

                    {tab === "appearance" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-[#2A3340] bg-[#10161D] p-6">
                <div className="text-lg font-semibold text-[#E5EEF7]">
                  Theme
                </div>
                <div className="mt-1 text-sm text-[#94A3B8]">
                  Choose how Bob AI looks on this device.
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => update("theme", "dark")}
                    className={
                      settings.theme === "dark"
                        ? "rounded-2xl border border-[#38BDF8]/30 bg-[#171D26] p-4 text-left transition-all duration-200"
                        : "rounded-2xl border border-[#2A3340] bg-[#141A22] p-4 text-left transition-all duration-200 hover:border-[#38BDF8]/30"
                    }
                  >
                    <div className="font-medium text-[#E5EEF7]">
                      Dark
                    </div>
                    <div className="mt-1 text-xs text-[#94A3B8]">
                      Deep charcoal interface
                    </div>
                  </button>

                  <button
                    onClick={() => update("theme", "system")}
                    className={
                      settings.theme === "system"
                        ? "rounded-2xl border border-[#38BDF8]/30 bg-[#171D26] p-4 text-left transition-all duration-200"
                        : "rounded-2xl border border-[#2A3340] bg-[#141A22] p-4 text-left transition-all duration-200 hover:border-[#38BDF8]/30"
                    }
                  >
                    <div className="font-medium text-[#E5EEF7]">
                      System
                    </div>
                    <div className="mt-1 text-xs text-[#94A3B8]">
                      Follow your device theme
                    </div>
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-[#2A3340] bg-[#10161D] p-6">
                <div className="text-lg font-semibold text-[#E5EEF7]">
                  Accent Color
                </div>
                <div className="mt-1 text-sm text-[#94A3B8]">
                  Sky blue is the default Bob AI accent.
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => update("accent", "sky")}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#38BDF8]/40 bg-[#171D26] transition-all duration-200 hover:scale-105"
                  >
                    <span className="h-5 w-5 rounded-full bg-[#38BDF8]" />
                  </button>

                  <div className="text-sm text-[#94A3B8]">
                    More accent colors are coming soon.
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <div className="rounded-3xl border border-[#2A3340] bg-[#10161D] p-6">
              <div className="text-lg font-semibold text-[#E5EEF7]">
                Privacy
              </div>
              <div className="mt-1 text-sm text-[#94A3B8]">
                Control what Bob AI can do and remember.
              </div>

              <div className="mt-4 space-y-4">
                <label className="flex items-center justify-between rounded-2xl border border-[#2A3340] bg-[#141A22] px-4 py-3">
                  <div>
                    <div className="font-medium text-[#E5EEF7]">
                      NSFW mode
                    </div>
                    <div className="text-sm text-[#94A3B8]">
                      Placeholder for future filtering controls.
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={settings.nsfw}
                    onChange={(e) =>
                      update("nsfw", e.target.checked)
                    }
                    className="h-4 w-4"
                  />
                </label>
              </div>
            </div>
          )}

          {tab === "memory" && (
            <div className="rounded-3xl border border-[#2A3340] bg-[#10161D] p-6">
              <div className="text-lg font-semibold text-[#E5EEF7]">
                Memory
              </div>
              <div className="mt-1 text-sm text-[#94A3B8]">
                Allow Bob AI to remember things across conversations.
              </div>

              <div className="mt-4 space-y-4">
                <label className="flex items-center justify-between rounded-2xl border border-[#2A3340] bg-[#141A22] px-4 py-3">
                  <div>
                    <div className="font-medium text-[#E5EEF7]">
                      Long-term memory
                    </div>
                    <div className="text-sm text-[#94A3B8]">
                      Save preferences and important information between chats.
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={settings.memory}
                    onChange={(e) =>
                      update("memory", e.target.checked)
                    }
                    className="h-4 w-4"
                  />
                </label>
              </div>
            </div>
          )}

          {tab === "about" && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-[#2A3340] bg-[#10161D] p-6">
                <div className="text-lg font-semibold text-[#E5EEF7]">
                  About Bob AI
                </div>
                <div className="mt-2 text-sm text-[#94A3B8]">
                  Bob AI Alpha • Local-first • Built for memory, file intelligence, image generation, web search, connected apps, and autonomous agents.
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-[#2A3340] bg-[#141A22] p-4">
                    <div className="text-[#94A3B8]">Model</div>
                    <div className="mt-1 font-medium text-[#E5EEF7]">
                      qwen2.5:3b
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#2A3340] bg-[#141A22] p-4">
                    <div className="text-[#94A3B8]">Mode</div>
                    <div className="mt-1 font-medium text-[#E5EEF7]">
                      Local
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-red-500/20 bg-[#10161D] p-6">
                <div className="text-lg font-semibold text-red-400">
                  Danger Zone
                </div>
                <div className="mt-2 text-sm text-[#94A3B8]">
                  This removes all locally stored conversations and settings.
                </div>

                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Delete all saved conversations and settings?"
                      )
                    ) {
                      localStorage.removeItem(
                        "bobai.conversations.v2"
                      );
                      localStorage.removeItem(
                        "bobai.settings.v1"
                      );
                      location.reload();
                    }
                  }}
                  className="mt-4 rounded-2xl border border-red-500/40 px-4 py-2 text-sm text-red-400 transition-all duration-200 hover:bg-red-500/10"
                >
                  Clear Conversations
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-end">
            <button
              onClick={save}
              disabled={!dirty}
              className={
                dirty
                  ? "rounded-2xl bg-[#38BDF8] px-5 py-2 text-sm font-semibold text-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0EA5E9] active:translate-y-0"
                  : "rounded-2xl border border-[#2A3340] bg-[#141A22] px-5 py-2 text-sm text-[#94A3B8]"
              }
            >
              {saved ? "Saved" : dirty ? "Save Changes" : "Saved"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}