"use client";

import AuthGate from "@/components/AuthGate";
import { request } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Integration = { id: string; provider: string; displayName?: string | null; scopes?: unknown; createdAt: string };
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
function IntegrationsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<Integration[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const data = await api<{ integrations: Integration[] }>("/integrations");
    setItems(data.integrations || []);
  }, []);
  useEffect(() => { void refresh().catch(e => setError(e instanceof Error ? e.message : "Could not load connected apps")); }, [refresh]);
  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const provider = params.get("provider");
    if (!code || !state || !provider) return;
    let active = true;
    setBusy("callback"); setError("");
    void api("/oauth/callback", { method: "POST", body: JSON.stringify({ provider, code, state }) })
      .then(async () => { if (!active) return; setNotice("App connected successfully."); await refresh(); router.replace("/integrations"); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Connection failed"); })
      .finally(() => { if (active) setBusy(""); });
    return () => { active = false; };
  }, [params, refresh, router]);
  async function connect(provider: "google" | "microsoft") {
    setBusy(provider); setError(""); setNotice("");
    try {
      const redirectUri = window.location.origin + "/integrations?provider=" + provider;
      const result = await api<{ url: string }>("/oauth/start", { method: "POST", body: JSON.stringify({ provider, redirectUri }) });
      if (!result.url || !result.url.startsWith("https://")) throw new Error("The provider returned an invalid authorization link.");
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start connection"); setBusy(""); }
  }
  async function disconnect(item: Integration) {
    if (!window.confirm("Disconnect " + (item.displayName || item.provider) + " from Jarvis?")) return;
    setBusy(item.id); setError(""); setNotice("");
    try { await api("/integrations/" + encodeURIComponent(item.id), { method: "DELETE" }); setNotice("App disconnected."); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not disconnect app"); }
    finally { setBusy(""); }
  }
  return <AuthGate><main className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-8"><div className="mx-auto max-w-4xl">
    <a href="/chat" className="text-sm text-[var(--muted)]">← Back to chat</a>
    <p className="mt-6 caption">JARVIS CONNECTIONS</p><h1 className="mt-1 font-display text-4xl sm:text-5xl">Connected apps</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Connect accounts you choose. Jarvis only receives the permissions shown by the provider, and you can disconnect an account here at any time.</p>
    {error && <p role="alert" className="mt-5 rounded-xl border border-[var(--danger)]/40 p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-[var(--border)] p-3 text-sm">{notice}</p>}
    <section className="mt-7 grid gap-3 sm:grid-cols-2">
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">Google</h2><p className="mt-1 text-sm text-[var(--muted)]">Gmail and Google Drive file access.</p><button disabled={!!busy} onClick={() => void connect("google")} className="btn-ink mt-5 w-full justify-center">{busy === "google" ? "Connecting…" : "Connect Google"}</button></article>
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">Microsoft 365</h2><p className="mt-1 text-sm text-[var(--muted)]">Outlook, OneDrive, Word, Excel and PowerPoint through Microsoft Graph permissions.</p><button disabled={!!busy} onClick={() => void connect("microsoft")} className="btn-ink mt-5 w-full justify-center">{busy === "microsoft" ? "Connecting…" : "Connect Microsoft 365"}</button></article>
    </section>
    <section className="mt-8"><h2 className="font-display text-2xl">Your connected accounts</h2>{items.length ? <div className="mt-3 space-y-2">{items.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div><p className="font-medium">{item.displayName || item.provider}</p><p className="mt-1 text-xs text-[var(--muted)]">Connected {new Date(item.createdAt).toLocaleDateString()}</p></div><button disabled={!!busy} onClick={() => void disconnect(item)} className="text-sm text-[var(--danger)] underline">{busy === item.id ? "Disconnecting…" : "Disconnect"}</button></article>)}</div> : <p className="mt-3 rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">No apps connected yet.</p>}</section>
    <p className="mt-7 text-xs leading-5 text-[var(--muted)]">Google and Microsoft developer credentials must be configured by the Jarvis owner before connecting. Provider consent screens control the actual permissions. Never share account passwords or app secrets with Jarvis chat.</p>
  </div></main></AuthGate>;
}
export default function IntegrationsPage() { return <IntegrationsContent />; }
