"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Trash2, RefreshCw, Pencil, Check, X } from "lucide-react";
import { useTheme } from "@/components/neural/ThemeProvider";
import { clearMemories, confirmAccountDeletion, deleteMemory, deleteSetting, getTypingProfile, getUsage, type TypingProfile, exportAccountData, listMemories, requestAccountDeletionCode, updateMemory } from "@/lib/api";
import { isGuest, logout } from "@/lib/auth";
import { deleteGuestAccount, logOutEverywhere } from "@/lib/api";

import { loadPreferences, savePreferences, type Preferences } from "@/lib/preferences";
import { GENERATIONS } from "@/lib/generation";
import { LANGUAGES, languageLabel, type LanguageId } from "@/lib/language";
import JarvisMark from "@/components/JarvisMark";
import LogoutWarning from "@/components/LogoutWarning";

type SettingsState = Preferences;
type Tab = "personalization" | "privacy" | "memory" | "research" | "about";

const tabs: { id: Tab; label: string }[] = [
  { id: "personalization", label: "Personalization" },
  { id: "privacy", label: "Privacy" },
  { id: "memory", label: "What I know" },
  { id: "about", label: "About" },
];

function readSettings(): SettingsState {
  const value = loadPreferences();
  return { ...value, sourceTypes: [...new Set(value.sourceTypes.filter((item) => ["official", "academic", "news", "general"].includes(item)))].slice(0, 4) };
}

/** Plain-language summary of the learned texting style. */
function describeTyping(profile: TypingProfile) {
  const lines = [profile.avgLength < 40 ? "You send short, quick messages." : profile.avgLength < 120 ? "Your messages are fairly short." : "You write longer, detailed messages."];
  if (profile.lowercase > 0.6) lines.push("You mostly type in lowercase.");
  if (profile.endPunctuation < 0.3) lines.push("You usually skip the full stop at the end.");
  else if (profile.endPunctuation > 0.7) lines.push("You use proper punctuation.");
  if (profile.emoji > 0.15) lines.push("You use emoji a lot.");
  else if (profile.emoji < 0.03) lines.push("You rarely use emoji.");
  if (profile.exclamation > 0.4) lines.push("You use plenty of exclamation marks!");
  if (profile.abbreviations > 0.3) lines.push("You use texting shortcuts like u, ur and rn.");
  return lines;
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  const [tab, setTab] = useState<Tab>("personalization");
  const [settings, setSettings] = useState<SettingsState>({ personality: "", memory: true, sourceTypes: ["general"], generation: "", learnStyle: true, language: "en", autoSendVoice: true, visualAnswers: true, voiceReplies: false, askBeforeBuilding: true, showCode: false });
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
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [logoutEverywhere, setLogoutEverywhere] = useState(false);
  // Two-tap confirmation for destructive buttons (in-app browsers often block window.confirm).
  const [armed, setArmed] = useState<"account" | "memories" | "guest" | null>(null);
  const [guest, setGuest] = useState(false);
  useEffect(() => setGuest(isGuest()), []);
  const armTimer = useRef<number | undefined>(undefined);
  function arm(action: "account" | "memories" | "guest") { setArmed(action); window.clearTimeout(armTimer.current); armTimer.current = window.setTimeout(() => setArmed(null), 6_000); }

  useEffect(() => setSettings(readSettings()), []);

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

  async function sendDeletionCode() {
    setDeleteBusy(true);
    setDeleteMessage("");
    try {
      const result = await requestAccountDeletionCode();
      setDeleteMessage(result.message || "If email delivery is configured, a deletion code has been sent.");
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : "Could not request a deletion code.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function deleteAccount() {
    if (!/^\d{6}$/.test(deleteCode)) {
      setDeleteMessage("Enter the 6-digit code sent to your email.");
      return;
    }
    if (armed !== "account") { arm("account"); return; }
    setArmed(null);
    setDeleteBusy(true);
    setDeleteMessage("");
    try {
      const result = await confirmAccountDeletion(deleteCode);
      void logout({ clearData: false });
      router.replace("/");
      setDeleteMessage(result.status || "Account deletion scheduled.");
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : "Could not schedule account deletion.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function downloadAccountExport() {
    setExportBusy(true);
    setExportMessage("");
    try {
      const blob = await exportAccountData();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "jarvis-account-export.json";
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
    if (armed !== "memories") { arm("memories"); return; }
    setArmed(null);
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

  const [typingProfile, setTypingProfile] = useState<TypingProfile | null>(null);
  useEffect(() => { void getTypingProfile().then(setTypingProfile).catch(() => undefined); }, []);
  const [usage, setUsage] = useState<{ used: number; limit: number; resetsAt: string } | null>(null);
  useEffect(() => { void getUsage().then((value) => setUsage(value?.messages ?? null)).catch(() => undefined); }, []);
  const [styleResetBusy, setStyleResetBusy] = useState(false);
  const [styleResetNotice, setStyleResetNotice] = useState("");
  async function resetTypingStyle() {
    setStyleResetBusy(true); setStyleResetNotice("");
    try { await deleteSetting("typingStyle"); setTypingProfile(null); setStyleResetNotice("Done. Jarvis forgot your texting style and will start learning again."); }
    catch { setStyleResetNotice("Couldn't reset right now. Try again in a moment."); }
    finally { setStyleResetBusy(false); }
  }

  function save() {
    try {
      savePreferences(settings);
      setDirty(false);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  // Theme tokens from globals.css follow light/dark automatically.
  const colors = {
    page: "relative z-[1] bg-[var(--bg)] text-[var(--text)]",
    sidebar: "border-[var(--hairline)] bg-[var(--surface)]",
    muted: "text-[var(--muted)]",
    card: "border-[var(--hairline)] bg-[var(--surface)]",
    field: "border-[var(--border)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--faint)]",
    button: "border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]",
    active: "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]",
  };

  return (
    <main id="main" tabIndex={-1} className={`min-h-screen ${colors.page}`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col sm:flex-row">
        <aside className={`w-full shrink-0 border-b p-4 sm:w-60 sm:border-b-0 sm:border-r sm:p-5 ${colors.sidebar}`}>
          <Link href="/chat" className="mb-6 flex items-center gap-3" aria-label="Back to Jarvis chat">
            <span className="atelier-wordmark">
<JarvisMark /></span>
            <span>
              <span className="block text-base font-semibold">Jarvis</span>
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
              <h1 className="font-display text-5xl leading-none">{tabs.find((item) => item.id === tab)?.label}</h1>
              <p className={`mt-2 text-sm ${colors.muted}`}>Make Jarvis feel more like you.</p>
            </div>
            <Link href="/chat" className={`rounded-lg border px-3 py-2 text-sm ${colors.button}`}>Back to chat</Link>
          </header>

          {tab === "personalization" && (
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="font-display text-2xl">How should Jarvis respond?</h2>
              <p className={`mt-1 text-sm ${colors.muted}`}>These instructions are sent with your chat requests. Don’t include passwords or private secrets.</p>
              <textarea aria-label="Personalization instructions for Jarvis"
                value={settings.personality}
                onChange={(event) => update("personality", event.target.value.slice(0, 12000))}
                maxLength={12000}
                rows={8}
                placeholder="For example: explain things clearly, use short paragraphs, and give examples."
                className={`mt-4 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--text)] ${colors.field}`}
              />
              <p className={`mt-2 text-xs ${colors.muted}`}>{settings.personality.length}/12000 characters</p>

              {usage && usage.limit > 0 && (
                <div className="mt-8">
                  <h2 className="font-display text-2xl">Today&apos;s messages</h2>
                  <p className={`mt-1 text-sm ${colors.muted}`}>{Math.min(usage.used, usage.limit)} of {usage.limit} used · resets {new Date(usage.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-[var(--surface-2)]" role="progressbar" aria-label="Messages used today" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={Math.min(usage.used, usage.limit)}>
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }} />
                  </div>
                </div>
              )}

              <h2 className="font-display mt-8 text-2xl">Reply language</h2>
              <p className={`mt-1 text-sm ${colors.muted}`}>Jarvis always answers in this language, unless you ask for a translation.</p>
              <select aria-label="Reply language" value={settings.language} onChange={(event) => update("language", event.target.value as LanguageId)} className={`mt-3 h-11 w-full max-w-sm rounded-xl border px-3 text-sm outline-none focus:border-[var(--text)] ${colors.field}`}>
                {LANGUAGES.map((language) => <option key={language.id} value={language.id}>{languageLabel(language.id)}</option>)}
              </select>

              <h2 className="font-display mt-8 text-2xl">Your generation</h2>
              <p className={`mt-1 text-sm ${colors.muted}`}>Jarvis texts you the way your generation does.</p>
              <select aria-label="Your generation" value={settings.generation} onChange={(event) => update("generation", event.target.value)} className={`mt-3 h-11 w-full max-w-sm rounded-xl border px-3 text-sm outline-none focus:border-[var(--text)] ${colors.field}`}>
                <option value="">Not set (natural style)</option>
                {GENERATIONS.map((generation) => <option key={generation.id} value={generation.id}>{generation.label} (born {generation.from === 1900 ? `before ${generation.to + 1}` : generation.to === 9999 ? `${generation.from} or later` : `${generation.from}–${generation.to}`})</option>)}
              </select>

              <h2 className="font-display mt-8 text-2xl">Pictures with answers</h2>
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={settings.visualAnswers} onChange={(event) => update("visualAnswers", event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                <span><span className="font-medium">Show pictures to help me understand</span><span className={`mt-1 block ${colors.muted}`}>Ask for ideas (like &quot;muggulu ideas&quot;) and Jarvis shows real pictures from Wikimedia Commons. Ask it to explain something and it draws a simple picture. Great for visual learners.</span></span>
              </label>

              <h2 className="font-display mt-8 text-2xl">Voice</h2>
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={settings.voiceReplies} onChange={(event) => update("voiceReplies", event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                <span><span className="font-medium">Read replies out loud</span><span className={`mt-1 block ${colors.muted}`}>Jarvis speaks each new answer in its voice. You can always tap the speaker on any reply, and Talk mode always speaks.</span></span>
              </label>

              <h2 className="font-display mt-8 text-2xl">Building websites</h2>
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={settings.askBeforeBuilding} onChange={(event) => update("askBeforeBuilding", event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                <span><span className="font-medium">Ask me a few questions first</span><span className={`mt-1 block ${colors.muted}`}>Before building, Jarvis asks what the site is for and how it should look, and waits for your go-ahead. Say &quot;just build it&quot; anytime to skip.</span></span>
              </label>
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={settings.showCode} onChange={(event) => update("showCode", event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                <span><span className="font-medium">Show the code</span><span className={`mt-1 block ${colors.muted}`}>Off: you see the finished website, with a View code button. On: you see the code first.</span></span>
              </label>

              <h2 className="font-display mt-8 text-2xl">Voice typing</h2>
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={settings.autoSendVoice} onChange={(event) => update("autoSendVoice", event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                <span><span className="font-medium">Send automatically when I stop talking</span><span className={`mt-1 block ${colors.muted}`}>Turn this off to check or edit what the mic typed before sending.</span></span>
              </label>

              <h2 className="font-display mt-8 text-2xl">Learn how I type</h2>
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={settings.learnStyle} onChange={(event) => update("learnStyle", event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
                <span className={colors.muted}>Jarvis picks up your texting style (message length, lowercase, emoji, slang you use) and replies the same way. It keeps only style numbers and a list of slang words, never your messages.</span>
              </label>
              <button type="button" onClick={() => void resetTypingStyle()} disabled={styleResetBusy} className={`mt-3 rounded-lg border px-3 py-2 text-sm disabled:opacity-40 ${colors.button}`}>{styleResetBusy ? "Resetting…" : "Forget my texting style"}</button>
              {styleResetNotice && <p role="status" className={`mt-2 text-sm ${colors.muted}`}>{styleResetNotice}</p>}
            </section>
          )}

          {tab === "privacy" && (
            <>
            <section className={`mb-5 rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="font-display text-2xl">Log out</h2>
              <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Log out here, or everywhere you&apos;re signed in. Your Jarvis data will be permanently cleared before you leave.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={loggingOut} onClick={() => { setLogoutEverywhere(false); setShowLogoutWarning(true); }} className="btn-ink !min-h-11 text-sm disabled:opacity-60">Log out</button>
                <button type="button" disabled={loggingOut} onClick={() => { setLogoutEverywhere(true); setShowLogoutWarning(true); }} className="btn-line !min-h-11 text-sm disabled:opacity-60">Log out on all devices</button>
              </div>
            </section>
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="font-display text-2xl">Privacy basics</h2>
              <ul className={`mt-4 list-disc space-y-3 pl-5 text-sm leading-6 ${colors.muted}`}>
                <li>Your messages are processed by Jarvis to generate replies and use the features you request. Avoid sharing passwords or other highly sensitive information in chat.</li>
                <li>Your response style, generation and memory preferences are stored in this browser. If “Learn how I type” is on, Jarvis keeps a small texting-style profile (numbers and slang words only) with your account.</li>
                <li>Do not enter secrets into chat or personalization instructions.</li>
                <li>Use the export and account-deletion controls below to manage your account data. Account deletion has a 30-day grace period.</li>
              </ul>
              <div className={`mt-5 rounded-xl border p-4 ${colors.field}`}>
                <h3 className="text-sm font-medium">Your account data</h3>
                <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Download a copy of the account information currently available to Jarvis. It may include private conversations and personal details, so keep the file secure.</p>
                <button type="button" onClick={() => void downloadAccountExport()} disabled={exportBusy} className="mt-3 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-[var(--bg)] disabled:opacity-40">{exportBusy ? "Preparing export…" : "Export account data"}</button>
                {exportMessage && <p role="status" className={`mt-2 text-xs ${colors.muted}`}>{exportMessage}</p>}
              </div>
              {guest ? (
              <div className={`mt-4 rounded-xl border border-[var(--danger)]/30 p-4 ${colors.field}`}>
                <h3 className="text-sm font-semibold text-[var(--danger)]">Delete guest account</h3>
                <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>You&apos;re using Jarvis as a guest. This deletes your guest chats, memories and settings and signs you out. It can&apos;t be undone.</p>
                <button type="button" disabled={deleteBusy} onClick={async () => {
                  if (armed !== "guest") { arm("guest"); return; }
                  setArmed(null); setDeleteBusy(true);
                  try { await deleteGuestAccount(); await logout({ clearData: false }); router.replace("/"); } catch (error) { setDeleteMessage(error instanceof Error ? error.message : "Could not delete the guest account."); } finally { setDeleteBusy(false); }
                }} className="mt-3 btn-danger">{armed === "guest" ? "Tap again to delete everything" : "Delete guest account"}</button>
                {deleteMessage && <p role="status" className={`mt-2 text-xs ${colors.muted}`}>{deleteMessage}</p>}
              </div>
              ) : (
              <div className={`mt-4 rounded-xl border border-[var(--danger)]/30 p-4 ${colors.field}`}>
                <h3 className="text-sm font-semibold text-[var(--danger)]">Delete account</h3>
                <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Verify your email with a one-time code to schedule account deletion. Your account is disabled immediately; permanent deletion is scheduled after a 30-day grace period. This does not replace any legally required data-retention obligations.</p>
                <button type="button" onClick={() => void sendDeletionCode()} disabled={deleteBusy} className="mt-3 btn-danger-line">{deleteBusy ? "Please wait…" : "Email me a deletion code"}</button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input value={deleteCode} onChange={(event) => setDeleteCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" aria-label="Account deletion email code" className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${colors.field}`} />
                  <button type="button" onClick={() => void deleteAccount()} disabled={deleteBusy || deleteCode.length !== 6} className="btn-danger">{armed === "account" ? "Tap again: disable my account now" : "Confirm deletion"}</button>
                </div>
                {deleteMessage && <p role="status" className={`mt-2 text-xs ${colors.muted}`}>{deleteMessage}</p>}
              </div>
              )}
              <p className={`mt-4 text-xs ${colors.muted}`}>Full details are in the <Link href="/privacy" className="md-link">Privacy Policy</Link>.</p>
            </section>
            </>
          )}

          <LogoutWarning
            open={showLogoutWarning}
            busy={loggingOut}
            guest={guest}
            allDevices={logoutEverywhere}
            onCancel={() => setShowLogoutWarning(false)}
            onConfirm={() => {
              setLoggingOut(true);
              void (logoutEverywhere ? logOutEverywhere() : logout()).then(() => router.replace("/login")).catch((error: unknown) => {
                setDeleteMessage(error instanceof Error ? error.message : "Could not clear your data. You are still signed in.");
                setLoggingOut(false);
              });
            }}
          />
          {tab === "memory" && (
            <div className="space-y-5">
              <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
                <h2 className="font-display text-2xl">What Jarvis has learned about you</h2>
                <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Everything Jarvis uses to personalize replies, in one place. You can change or delete any of it.</p>
                <dl className="mt-5 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)] text-sm">
                  <div className="py-3">
                    <dt className="font-medium">Reply language</dt>
                    <dd className={`mt-1 ${colors.muted}`}>{languageLabel(settings.language)} <button type="button" onClick={() => setTab("personalization")} className="md-link ml-1">change</button></dd>
                  </div>
                  <div className="py-3">
                    <dt className="font-medium">Your generation</dt>
                    <dd className={`mt-1 ${colors.muted}`}>{GENERATIONS.find((generation) => generation.id === settings.generation)?.label ?? "Not set"} <button type="button" onClick={() => setTab("personalization")} className="md-link ml-1">change</button></dd>
                  </div>
                  <div className="py-3">
                    <dt className="font-medium">How you text</dt>
                    <dd className={`mt-1 leading-6 ${colors.muted}`}>
                      {!settings.learnStyle ? "Turned off in Personalization." : typingProfile && typingProfile.messages >= 3 ? (
                        <>
                          <ul className="list-disc space-y-1 pl-5">{describeTyping(typingProfile).map((line) => <li key={line}>{line}</li>)}</ul>
                          {Object.keys(typingProfile.slang).length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{Object.entries(typingProfile.slang).slice(0, 10).map(([word, count]) => <span key={word} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">{word} ×{count}</span>)}</p>}
                          <p className="mt-2 text-xs">Based on {typingProfile.messages} of your messages. <button type="button" onClick={() => void resetTypingStyle()} disabled={styleResetBusy} className="md-link">Forget this</button></p>
                        </>
                      ) : "Still learning. Chat a bit more and this will fill in."}
                    </dd>
                  </div>
                  <div className="py-3">
                    <dt className="font-medium">Things you asked it to remember</dt>
                    <dd className={`mt-1 ${colors.muted}`}>{memories.length ? `${memories.length} saved, listed below.` : "Nothing yet. Say \"remember that…\" in a chat."}</dd>
                  </div>
                </dl>
              </section>
              <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
                <h2 className="font-display text-2xl">Memory preference</h2>
                <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Turn memory off to stop using saved memories in future chats. This switch does not delete memories already stored on the server.</p>
                <label className={`mt-5 flex items-center justify-between gap-4 rounded-xl border p-4 ${colors.field}`}>
                  <span>
                    <span className="block text-sm font-medium">Use memory in chats</span>
                    <span className={`mt-1 block text-xs ${colors.muted}`}>This preference is saved in this browser.</span>
                  </span>
                  <input type="checkbox" checked={settings.memory} onChange={(event) => update("memory", event.target.checked)} className="size-4 accent-[var(--accent)]" />
                </label>
              </section>
              <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl">Saved memories</h2>
                    <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Review or delete information stored in your account. Deleting memory does not delete chat history.</p>
                  </div>
                  <button type="button" onClick={removeAllMemories} disabled={memoryLoading || memories.length === 0 || memoryBusyId !== null} className="inline-flex items-center gap-2 rounded-lg border border-[var(--danger)]/30 px-3 py-2 text-sm text-[var(--danger)] disabled:opacity-40">
                    <Trash2 className="h-4 w-4" aria-hidden /> {armed === "memories" ? "Tap again to delete all" : "Delete all"}
                  </button>
                </div>
                {memoryError && <p role="alert" className="mt-4 text-sm text-[var(--danger)]">{memoryError}</p>}
                {memoryNotice && <p role="status" className="mt-4 text-sm text-emerald-600">{memoryNotice}</p>}
                {memoryLoading ? (
                  <p className={`mt-5 text-sm ${colors.muted}`}>Loading saved memories…</p>
                ) : memories.length === 0 ? (
                  <p className={`mt-5 rounded-xl border border-dashed p-4 text-sm ${colors.muted}`}>No saved memories found.</p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {memories.map((memory, index) => {
                      const id = typeof memory.id === "string" ? memory.id : "";
                      const rawTitle = typeof memory.category === "string" && memory.category.trim() ? memory.category : typeof memory.key === "string" && memory.key.trim() ? memory.key : "";
                      // "explicit memory" is the internal name for things you asked Jarvis to remember.
                      const title = !rawTitle || /^explicit memory$/i.test(rawTitle) ? "You asked me to remember" : rawTitle;
                      const body = typeof memory.content === "string" ? memory.content : typeof memory.value === "string" ? memory.value : "";
                      return (
                        <li key={id || `memory-${index}`} className={`flex items-start gap-3 rounded-xl border p-4 ${colors.field}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{title}</p>
                            {memoryEditId === id ? (
                              <div className="mt-2">
                                <textarea value={memoryEditContent} onChange={(event) => setMemoryEditContent(event.target.value.slice(0, 20_000))} maxLength={20_000} rows={4} className={`w-full resize-y rounded-lg border px-3 py-2 text-sm leading-6 ${colors.field}`} aria-label={`Edit memory: ${body.slice(0, 40)}`} />
                                <div className={`mt-1 text-right text-xs ${colors.muted}`}>{memoryEditContent.length}/20000</div>
                              </div>
                            ) : (
                              <p className={`mt-1 whitespace-pre-wrap break-words text-sm leading-6 ${colors.muted}`}>{body || "No content available for display."}</p>
                            )}
                          </div>
                          {memoryEditId === id ? (
                            <div className="flex shrink-0 gap-1">
                              <button type="button" onClick={() => void saveMemoryEdit(id)} disabled={memoryBusyId !== null || !memoryEditContent.trim()} aria-label={`Save memory: ${body.slice(0, 40)}`} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40">
                                {memoryBusyId === id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button type="button" onClick={() => { setMemoryEditId(null); setMemoryEditContent(""); }} disabled={memoryBusyId !== null} aria-label="Cancel memory edit" className={`rounded-lg p-2 ${colors.muted} hover:bg-[var(--surface-2)] disabled:opacity-40`}><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <div className="flex shrink-0 gap-1">
                              <button type="button" onClick={() => { setMemoryEditId(id); setMemoryEditContent(body); setMemoryError(""); setMemoryNotice(""); }} disabled={!id || memoryBusyId !== null} aria-label={`Edit memory: ${body.slice(0, 40)}`} className={`rounded-lg p-2 ${colors.muted} hover:bg-[var(--surface-2)] disabled:opacity-40`}><Pencil className="h-4 w-4" /></button>
                              <button type="button" onClick={() => id && void removeMemory(id)} disabled={!id || memoryBusyId !== null} aria-label={`Delete memory: ${body.slice(0, 40)}`} className="rounded-lg p-2 text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-40">
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

          {tab === "research" && (
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="font-display text-2xl">Default research sources</h2>
              <p className={`mt-1 text-sm leading-6 ${colors.muted}`}>Choose the default source types for Deep Research. You can change these for an individual request in the research panel. If you clear every option, Jarvis searches broadly.</p>
              <div className="mt-4 space-y-3">
                {([["official", "Official and government sources", "Government and official institutional sites"], ["academic", "Academic and research sources", "Universities, research archives, and selected journals"], ["news", "Reputable news sources", "Selected news publishers"], ["general", "All web sources", "Do not restrict search to a source category"]] as const).map(([value, label, description]) => (
                  <label key={value} className={`flex items-start gap-3 rounded-xl border p-4 ${colors.field}`}>
                    <input
                      type="checkbox"
                      checked={settings.sourceTypes.includes(value)}
                      onChange={(event) => { if (event.target.checked) update("sourceTypes", value === "general" ? ["general"] : [...new Set([...settings.sourceTypes.filter((item) => item !== "general"), value])]); else if (settings.sourceTypes.length > 1) update("sourceTypes", settings.sourceTypes.filter((item) => item !== value)); }}
                      className="mt-1 size-4 accent-[var(--accent)]"
                    />
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className={`mt-1 block text-xs leading-5 ${colors.muted}`}>{description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {tab === "about" && (
            <section className={`rounded-2xl border p-5 sm:p-6 ${colors.card}`}>
              <h2 className="font-display text-2xl">About Jarvis</h2>
              <p className={`mt-2 text-sm leading-6 ${colors.muted}`}>Jarvis brings conversation, research, voice, coding, files and creative tools together in one place. Its features are designed to make everyday tasks simpler.</p>
              <div className={`mt-5 rounded-xl border p-4 text-sm ${colors.field}`}>
                <div className="font-medium">Your appearance</div>
                <div className={`mt-1 ${colors.muted}`}>{light ? "Light mode" : "Dark mode"} · saved in this browser</div>
              </div>
            </section>
          )}

          {(tab === "personalization" || tab === "memory") && <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            {saved && <p role="status" className="text-sm text-emerald-600">Preferences saved.</p>}
            {!saved && !dirty && <p className={`text-xs ${colors.muted}`}>No unsaved changes</p>}
            <button type="button" onClick={save} disabled={!dirty} className="rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40">Save preferences</button>
          </div>}
        </section>
      </div>
    </main>
  );
}
