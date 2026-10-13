"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/neural/ThemeProvider";

const SETTINGS_KEY = "bobai.settings.v1";

type SettingsState = { personality: string; memory: boolean };
type Tab = "personalization" | "privacy" | "memory" | "about";

const tabs: { id: Tab; label: string }[] = [
  { id: "personalization", label: "Personalization" },
  { id: "privacy", label: "Privacy" },
  { id: "memory", label: "Memory" },
  { id: "about", label: "About" },
];

function readSettings(): SettingsState {
  const defaults: SettingsState = { personality: "", memory: true };
  try {
    const value = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}") as Partial<SettingsState>;
    return {
      personality: typeof value.personality === "string" ? value.personality.slice(0, 12000) : defaults.personality,
      memory: value.memory !== false,
    };
  } catch {
    return defaults;
  }
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  const [tab, setTab] = useState<Tab>("personalization");
  const [settings, setSettings] = useState<SettingsState>({ personality: "", memory: true });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => setSettings(readSettings()), []);

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  function save() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setDirty(false);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  const colors = light
    ? {
        page: "bg-[#f7f8fa] text-[#202123]",
        sidebar: "border-[#e5e7eb] bg-white",
        muted: "text-[#6b7280]",
        card: "border-[#e5e7eb] bg-white",
        field: "border-[#d1d5db] bg-white text-[#202123] placeholder:text-[#9ca3af]",
        button: "border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f3f4f6]",
        active: "border-sky-200 bg-sky-50 text-sky-900",
      }
    : {
        page: "bg-[#08090b] text-[#f5f5f5]",
        sidebar: "border-white/10 bg-[#0d0e10]",
        muted: "text-white/50",
        card: "border-white/10 bg-[#111214]",
        field: "border-white/10 bg-[#191a1d] text-white placeholder:text-white/30",
        button: "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]",
        active: "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100",
      };

  return (
    <main className={`min-h-screen ${colors.page}`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col sm:flex-row">
        <aside className={`w-full shrink-0 border-b p-4 sm:w-60 sm:border-b-0 sm:border-r sm:p-5 ${colors.sidebar}`}>
          <Link href="/chat" className="mb-6 flex items-center gap-3" aria-label="Back to Bob AI chat">
            <span className="grid size-9 place-items-center rounded-xl border border-sky-400/25 bg-sky-400/10 font-semibold text-sky-500">B</span>
            <span>
              <span className="block text-base font-semibold">Bob AI</span>
              <span className={`block text-xs ${colors.muted}`}>Settings</span>
            </span>
          </Link>
          <nav aria-label="Settings sections" className="grid grid-cols-2 gap-1 sm:grid-cols-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${tab === item.id ? colors.active : `border-transparent ${colors.muted} hover:bg-black/[0.04]`}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button type="button" onClick={toggleTheme} className={`mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm ${colors.button}`} aria-label={light ? "Switch to dark mode" : "Switch to light mode"}>
            {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {light ? "Dark mode" : "Light mode"}
          </button>
        </aside>

        <section className="min-w-0 flex-1 p-4 sm:p-8">
          <header className="mb-7 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{tabs.find((item) => item.id === tab)?.label}</h1>
              <p className={`mt-2 text-sm ${colors.muted}`}>Manage the preferences Bob AI currently supports.</p>
            </div>
            <Link href="/chat" className={`rounded-lg border px-3 py-2 text-sm ${colors.button}`}>Back to chat</Link>
          </header>

          {tab === "personalization" && (
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="text-base font-semibold">How should Bob AI respond?</h2>
              <p className={`mt-1 text-sm ${colors.muted}`}>These instructions are sent with your chat requests. Don’t include passwords or private secrets.</p>
              <textarea
                value={settings.personality}
                onChange={(event) => update("personality", event.target.value.slice(0, 12000))}
                maxLength={12000}
                rows={8}
                placeholder="For example: explain things clearly, use short paragraphs, and give examples."
                className={`mt-4 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 outline-none focus:border-sky-400 ${colors.field}`}
              />
              <p className={`mt-2 text-xs ${colors.muted}`}>{settings.personality.length}/12000 characters</p>
            </section>
          )}

          {tab === "privacy" && (
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="text-base font-semibold">Privacy basics</h2>
              <ul className={`mt-4 list-disc space-y-3 pl-5 text-sm leading-6 ${colors.muted}`}>
                <li>Chat requests are sent to the BobAI API configured for this installation. The model provider depends on that server’s configuration.</li>
                <li>Your response-style and memory preferences are stored in this browser’s local storage.</li>
                <li>Do not enter secrets into chat or personalization instructions.</li>
                <li>Use sign-out from the account controls provided by your installation. This page does not pretend to delete server data.</li>
              </ul>
              <p className={`mt-4 text-xs ${colors.muted}`}>This is a practical summary, not a complete legal privacy notice. The service operator should publish a policy matching the actual deployment and providers.</p>
            </section>
          )}

          {tab === "memory" && (
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="text-base font-semibold">Memory preference</h2>
              <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>When enabled, Bob AI includes the memory preference in chat requests so the API can apply its supported memory behavior. This switch does not erase memories already stored on the server.</p>
              <label className={`mt-5 flex items-center justify-between gap-4 rounded-xl border p-4 ${colors.field}`}>
                <span>
                  <span className="block text-sm font-medium">Use memory in chats</span>
                  <span className={`mt-1 block text-xs ${colors.muted}`}>You can turn this off for future requests.</span>
                </span>
                <input type="checkbox" checked={settings.memory} onChange={(event) => update("memory", event.target.checked)} className="size-4 accent-sky-500" />
              </label>
            </section>
          )}

          {tab === "about" && (
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="text-base font-semibold">About Bob AI</h2>
              <p className={`mt-2 text-sm leading-6 ${colors.muted}`}>Bob AI is a work-in-progress AI chat workspace. Available features depend on the API and provider configured by the person running this installation.</p>
              <div className={`mt-5 rounded-xl border p-4 text-sm ${colors.field}`}>
                <div className="font-medium">Current appearance</div>
                <div className={`mt-1 ${colors.muted}`}>{light ? "Light mode" : "Dark mode"} · saved in this browser</div>
              </div>
            </section>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            {saved && <p role="status" className="text-sm text-emerald-600">Preferences saved.</p>}
            {!saved && !dirty && <p className={`text-xs ${colors.muted}`}>No unsaved changes</p>}
            <button type="button" onClick={save} disabled={!dirty} className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40">Save preferences</button>
          </div>
        </section>
      </div>
    </main>
  );
}
