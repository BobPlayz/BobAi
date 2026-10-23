"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const LIST: Array<[string, string]> = [["⌘/Ctrl + K", "New chat"], ["/", "Jump to the message box"], ["Esc", "Stop the reply"], ["Enter", "Send"], ["Shift + Enter", "New line"], ["?", "Show these shortcuts"]];

function typing(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)));
}

/** Chat keyboard shortcuts, plus a "?" cheat sheet. */
export default function Shortcuts({ onNewChat, onStop, streaming }: { onNewChat: () => void; onStop: () => void; streaming: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); onNewChat(); window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message Jarvis"]')?.focus(), 50); return; }
      if (event.key === "Escape") { if (open) setOpen(false); else if (streaming) onStop(); return; }
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") { event.preventDefault(); document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message Jarvis"]')?.focus(); }
      else if (event.key === "?") { event.preventDefault(); setOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewChat, onStop, streaming, open]);
  useEffect(() => { if (open) close.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(21,19,15,0.45)] p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between gap-3">
          <h2 id="shortcuts-title" className="font-display text-3xl">Shortcuts</h2>
          <button ref={close} type="button" onClick={() => setOpen(false)} aria-label="Close shortcuts" className="atelier-iconbtn"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          {LIST.map(([keys, action]) => (
            <div key={keys} className="flex items-center justify-between gap-4"><dt className="text-[var(--muted)]">{action}</dt><dd><kbd className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-xs">{keys}</kbd></dd></div>
          ))}
        </dl>
      </section>
    </div>
  );
}
