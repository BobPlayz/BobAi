"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun, Trash2, RefreshCw, Pencil, Check, X } from "lucide-react";
import { useTheme } from "@/components/neural/ThemeProvider";
import { clearMemories, deleteMemory, exportAccountData, getModelStatus, listMemories, updateMemory } from "@/lib/api";

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
  const [memories, setMemories] = useState<Array<Record<string, unknown>>>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryBusyId, setMemoryBusyId] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState("");
  const [memoryNotice, setMemoryNotice] = useState("");
  const [memoryEditId, setMemoryEditId] = useState<string | null>(null);
  const [memoryEditContent, setMemoryEditContent] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [providerStatus, setProviderStatus] = useState<{ ready?: boolean; provider?: string; model?: string; modelId?: string; error?: string } | null>(null);
  const [providerStatusError, setProviderStatusError] = useState("");

  useEffect(() => setSettings(readSettings()), []);

  useEffect(() => {
    if (tab !== "about") return;
    let cancelled = false;
    setProviderStatusError("");
    void getModelStatus().then((status) => {
      if (!cancelled) setProviderStatus(status);
    }).catch((error: unknown) => {
      if (!cancelled) setProviderStatusError(error instanceof Error ? error.message : "Provider status is unavailable.");
    });
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    if (tab !== "memory") return;
    let cancelled = false;
    setMemoryLoading(true);
    setMemoryError("");
    void listMemories().then((items) => {
      if (!cancelled) setMemories(items);
    }).catch((error: unknown) => {
      if (!cancelled) setMemoryError(error instanceof Error ? error.message : "Could not load saved memory.");
    }).finally(() => {
      if (!cancelled) setMemoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab]);

  async function downloadAccountExport() {
    setExportBusy(true);
    setExportMessage("");
    try {
      const blob = await exportAccountData();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "bobai-account-export.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setExportMessage("Your account export was prepared.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Could not export account data.");
    } finally {
      setExportBusy(false);
    }
  }

  async function saveMemoryEdit(id: string) {
    const content = memoryEditContent.trim();
    if (!content || content.length > 20_000) {
      setMemoryError("Memory text must contain 1 to 20,000 characters.");
      return;
    }
    setMemoryBusyId(id);
    setMemoryError("");
    setMemoryNotice("");
    try {
      const updated = await updateMemory(id, { content });
      setMemories((current) => current.map((item) => item.id === id ? { ...item, ...(updated && typeof updated === "object" ? updated as Record<string, unknown> : {}), content } : item));
      setMemoryEditId(null);
      setMemoryEditContent("");
      setMemoryNotice("Saved memory updated.");
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "Could not update that memory.");
    } finally {
      setMemoryBusyId(null);
    }
  }

  async function removeMemory(id: string) {
    setMemoryBusyId(id);
    setMemoryError("");
    setMemoryNotice("");
    try {
      await deleteMemory(id);
      setMemories((current) => current.filter((item) => item.id !== id));
      setMemoryNotice("Saved memory deleted.");
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "Could not delete that memory.");
    } finally {
      setMemoryBusyId(null);
    }
  }

  async function removeAllMemories() {
    if (!window.confirm("Delete all saved Bob AI memories? This cannot be undone.")) return;
    setMemoryBusyId("__all__");
    setMemoryError("");
    setMemoryNotice("");
    try {
      await clearMemories();
      setMemories([]);
      setMemoryNotice("All saved memories were deleted.");
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "Could not clear saved memory.");
    } finally {
      setMemoryBusyId(null);
    }
  }

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
              <div className={`mt-5 rounded-xl border p-4 ${colors.field}`}>
                <h3 className="text-sm font-medium">Your account data</h3>
                <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Download the account data currently available through the authenticated API. The export may contain private conversations and account information, so keep the file secure.</p>
                <button type="button" onClick={() => void downloadAccountExport()} disabled={exportBusy} className="mt-3 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{exportBusy ? "Preparing export…" : "Export account data"}</button>
                {exportMessage && <p role="status" className={`mt-2 text-xs ${colors.muted}`}>{exportMessage}</p>}
              </div>
              <p className={`mt-4 text-xs ${colors.muted}`}>This is a practical summary, not a complete legal privacy notice. The service operator should publish a policy matching the actual deployment and providers.</p>
            </section>
          )}

          {tab === "memory" && (
            <div className="space-y-5">
              <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
                <h2 className="text-base font-semibold">Memory preference</h2>
                <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Turn memory off to stop using saved memories in future chats. This switch does not delete memories already stored on the server.</p>
                <label className={`mt-5 flex items-center justify-between gap-4 rounded-xl border p-4 ${colors.field}`}>
                  <span>
                    <span className="block text-sm font-medium">Use memory in chats</span>
                    <span className={`mt-1 block text-xs ${colors.muted}`}>This preference is saved in this browser.</span>
                  </span>
                  <input type="checkbox" checked={settings.memory} onChange={(event) => update("memory", event.target.checked)} className="size-4 accent-sky-500" />
                </label>
              </section>
              <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Saved memories</h2>
                    <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Review or delete information stored in your account. Deleting memory does not delete chat history.</p>
                  </div>
                  <button type="button" onClick={removeAllMemories} disabled={memoryLoading || memories.length === 0 || memoryBusyId !== null} className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-600 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" /> Delete all
                  </button>
                </div>
                {memoryError && <p role="alert" className="mt-4 text-sm text-red-500">{memoryError}</p>}
                {memoryNotice && <p role="status" className="mt-4 text-sm text-emerald-600">{memoryNotice}</p>}
                {memoryLoading ? (
                  <p className={`mt-5 text-sm ${colors.muted}`}>Loading saved memories…</p>
                ) : memories.length === 0 ? (
                  <p className={`mt-5 rounded-xl border border-dashed p-4 text-sm ${colors.muted}`}>No saved memories found.</p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {memories.map((memory, index) => {
                      const id = typeof memory.id === "string" ? memory.id : "";
                      const title = typeof memory.category === "string" && memory.category.trim() ? memory.category : typeof memory.key === "string" && memory.key.trim() ? memory.key : `Memory ${index + 1}`;
                      const body = typeof memory.content === "string" ? memory.content : typeof memory.value === "string" ? memory.value : "";
                      return (
                        <li key={id || `memory-${index}`} className={`flex items-start gap-3 rounded-xl border p-4 ${colors.field}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{title}</p>
                            {memoryEditId === id ? (
                              <div className="mt-2">
                                <textarea value={memoryEditContent} onChange={(event) => setMemoryEditContent(event.target.value.slice(0, 20_000))} maxLength={20_000} rows={4} className={`w-full resize-y rounded-lg border px-3 py-2 text-sm leading-6 ${colors.field}`} aria-label={`Edit ${title}`} />
                                <div className={`mt-1 text-right text-xs ${colors.muted}`}>{memoryEditContent.length}/20000</div>
                              </div>
                            ) : (
                              <p className={`mt-1 whitespace-pre-wrap break-words text-sm leading-6 ${colors.muted}`}>{body || "No content available for display."}</p>
                            )}
                          </div>
                          {memoryEditId === id ? (
                            <div className="flex shrink-0 gap-1">
                              <button type="button" onClick={() => void saveMemoryEdit(id)} disabled={memoryBusyId !== null || !memoryEditContent.trim()} aria-label={`Save ${title}`} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40">
                                {memoryBusyId === id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button type="button" onClick={() => { setMemoryEditId(null); setMemoryEditContent(""); }} disabled={memoryBusyId !== null} aria-label="Cancel memory edit" className={`rounded-lg p-2 ${colors.muted} hover:bg-black/5 disabled:opacity-40`}><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <div className="flex shrink-0 gap-1">
                              <button type="button" onClick={() => { setMemoryEditId(id); setMemoryEditContent(body); setMemoryError(""); setMemoryNotice(""); }} disabled={!id || memoryBusyId !== null} aria-label={`Edit ${title}`} className={`rounded-lg p-2 ${colors.muted} hover:bg-black/5 disabled:opacity-40`}><Pencil className="h-4 w-4" /></button>
                              <button type="button" onClick={() => id && void removeMemory(id)} disabled={!id || memoryBusyId !== null} aria-label={`Delete ${title}`} className="rounded-lg p-2 text-red-500 hover:bg-red-500/10 disabled:opacity-40">
                                {memoryBusyId === id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === "about" && (
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="text-base font-semibold">About Bob AI</h2>
              <p className={`mt-2 text-sm leading-6 ${colors.muted}`}>Bob AI is a work-in-progress AI chat workspace. Available features depend on the API and provider configured by the person running this installation.</p>
              <div className={`mt-5 rounded-xl border p-4 text-sm ${colors.field}`}>
                <div className="font-medium">Current appearance</div>
                <div className={`mt-1 ${colors.muted}`}>{light ? "Light mode" : "Dark mode"} · saved in this browser</div>
              </div>
              <div className={`mt-4 rounded-xl border p-4 text-sm ${colors.field}`}>
                <div className="font-medium">Configured AI provider</div>
                {providerStatus ? (
                  <>
                    <div className={`mt-2 ${colors.muted}`}>Provider: {providerStatus.provider || "reported by API"}</div>
                    <div className={`mt-1 ${colors.muted}`}>Model: {providerStatus.model || providerStatus.modelId || "not reported"}</div>
                    <div className={`mt-1 ${providerStatus.ready ? "text-emerald-600" : "text-amber-600"}`}>{providerStatus.ready ? "Ready" : providerStatus.error || "Not ready"}</div>
                  </>
                ) : <p className={`mt-2 ${colors.muted}`}>{providerStatusError || "Checking provider status…"}</p>}
                <p className={`mt-2 text-xs ${colors.muted}`}>This reports server configuration only. It does not guarantee live provider availability or disclose API keys.</p>
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
