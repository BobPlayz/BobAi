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
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("personalization");
  const [settings, setSettings] = useState<SettingsState>({
    personality: "",
    nsfw: false,
    memory: true,
    theme: "dark",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<SettingsState>;
      setSettings((prev) => ({ ...prev, ...parsed }));
    } catch {}
  }, []);

  function save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "account", label: "account" },
    { id: "personalization", label: "personalization" },
    { id: "appearance", label: "appearance" },
    { id: "privacy", label: "privacy" },
    { id: "memory", label: "memory" },
    { id: "about", label: "about" },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-5xl gap-8 px-6 py-10">
        <aside className="w-64 rounded-2xl border border-white/10 bg-[#121212] p-3">
          <div className="mb-2 px-3 py-2 text-xs uppercase tracking-wide text-white/40">
            settings
          </div>

          <nav className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? "w-full rounded-xl bg-white/5 px-3 py-2 text-left text-sm text-white"
                    : "w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
                }
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold capitalize">
                {tab}
              </h1>
              <p className="mt-2 text-white/45">
                configure how bobai works for you
              </p>
            </div>

            <Link
              href="/chat"
              className="rounded-xl border border-white/10 bg-[#121212] px-4 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              ← back
            </Link>
          </div>

          {tab === "account" && (
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-6">
              <div className="text-lg font-semibold">account</div>
              <div className="mt-2 text-sm text-white/45">
                signed in as <span className="text-white">bob</span>
              </div>
              <div className="mt-6 space-y-3">
                <button className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-left text-white/80 hover:bg-white/5">
                  manage account
                </button>
                <button className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-left text-red-400 hover:bg-white/5">
                  sign out
                </button>
              </div>
            </div>
          )}

          {tab === "personalization" && (
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-6">
              <div className="text-lg font-semibold">personality</div>
              <div className="mt-1 text-sm text-white/45">
                tell bobai exactly how you want it to respond
              </div>

              <textarea
                value={settings.personality}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    personality: e.target.value,
                  }))
                }
                placeholder="talk like me, use lowercase, keep replies short, roast me back, don't sound like chatgpt..."
                className="mt-4 h-56 w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-4 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
              />
            </div>
          )}

          {tab === "appearance" && (
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-6">
              <div className="text-lg font-semibold">appearance</div>
              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-4 py-3">
                  <span>dark mode</span>
                  <input
                    type="radio"
                    checked={settings.theme === "dark"}
                    onChange={() =>
                      setSettings((prev) => ({
                        ...prev,
                        theme: "dark",
                      }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-4 py-3">
                  <span>system theme</span>
                  <input
                    type="radio"
                    checked={settings.theme === "system"}
                    onChange={() =>
                      setSettings((prev) => ({
                        ...prev,
                        theme: "system",
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-6">
              <div className="text-lg font-semibold">privacy</div>
              <div className="mt-4 space-y-4">
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-4 py-3">
                  <div>
                    <div className="font-medium text-white">
                      nsfw mode
                    </div>
                    <div className="text-sm text-white/40">
                      placeholder for future filtering controls
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.nsfw}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        nsfw: e.target.checked,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          )}

          {tab === "memory" && (
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-6">
              <div className="text-lg font-semibold">memory</div>
              <div className="mt-4 space-y-4">
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-4 py-3">
                  <div>
                    <div className="font-medium text-white">
                      memory
                    </div>
                    <div className="text-sm text-white/40">
                      allow bobai to remember things across conversations
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.memory}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        memory: e.target.checked,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          )}

          {tab === "about" && (
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-6">
              <div className="text-lg font-semibold">about bobai</div>
              <div className="mt-2 text-sm text-white/45">
                bobai alpha • local build • future-ready architecture for memory,
                image generation, web search, connected apps, and autonomous agents.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              onClick={save}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              {saved ? "saved" : "save"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}