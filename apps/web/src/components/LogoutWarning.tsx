"use client";

import { AlertTriangle } from "lucide-react";

export default function LogoutWarning({ open, busy, allDevices = false, onCancel, onConfirm }: {
  open: boolean;
  busy: boolean;
  allDevices?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(15,15,15,0.58)] p-4" role="presentation">
      <section role="alertdialog" aria-modal="true" aria-labelledby="logout-warning-title" aria-describedby="logout-warning-description" className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)] shadow-[var(--shadow)]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--danger)]/10 text-[var(--danger)]"><AlertTriangle className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 id="logout-warning-title" className="font-display text-2xl">Permanently clear your Jarvis data?</h2>
            <p id="logout-warning-description" className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Logging out will permanently delete your conversations, saved memories, uploaded files, projects, personal settings and other account data from Jarvis servers and this device. This cannot be undone.
            </p>
            <p className="mt-2 text-sm font-medium leading-6">Your login account, email, password and sign-in security settings will remain active. Limited security records needed to protect the service may also be retained. You can sign in again, but your old data will not return. Guest sessions cannot be recovered after logout.</p>
            {allDevices && <p className="mt-2 text-sm leading-6 text-[var(--muted)]">You will also be signed out on every other device.</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="btn-line !min-h-11 text-sm">Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="btn-danger !min-h-11 text-sm disabled:opacity-50">{busy ? "Clearing data…" : "Delete data & log out"}</button>
        </div>
      </section>
    </div>
  );
}
