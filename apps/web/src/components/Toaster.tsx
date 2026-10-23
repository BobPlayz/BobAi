"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT } from "@/lib/toast";

/** Shows the latest toast() message for a moment at the bottom of the screen; announced to screen readers too. */
export default function Toaster() {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const onToast = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      if (!text) return;
      setMessage({ text, key: Date.now() });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 2_200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => { window.removeEventListener(TOAST_EVENT, onToast); window.clearTimeout(timer); };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(6rem+env(safe-area-inset-top))] z-[100] flex justify-center px-4">
      {message && <p key={message.key} className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg)] shadow-[var(--shadow)] animate-[chatEnter_220ms_ease-out_both] motion-reduce:animate-none">{message.text}</p>}
    </div>
  );
}
