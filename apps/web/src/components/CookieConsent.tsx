"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const STORAGE_KEY = "bobai-analytics-consent";

function safeAnalyticsUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const [consent, setConsent] = useState<string | null>(null);
  const analyticsUrl = safeAnalyticsUrl(process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN);

  useEffect(() => {
    setConsent(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  if (consent === "accepted") {
    const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN;
    return analyticsUrl ? <Script defer data-domain={siteDomain} src={`${analyticsUrl}/js/script.js`} /> : null;
  }

  if (!analyticsUrl || consent === "declined") return null;

  const choose = (value: "accepted" | "declined") => {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  };

  return (
    <aside className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-[var(--shadow)]" aria-label="Analytics consent">
      <p className="text-sm leading-6 text-[var(--muted)]">Jarvis uses strictly necessary authentication cookies to keep you signed in. Optional privacy-conscious analytics are separate and are never loaded unless you allow them.</p>
      <div className="mt-2 text-xs text-[var(--muted)]">Read the <a href="/privacy" className="md-link">Privacy Policy</a> before choosing.</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose("accepted")} className="btn-ink !min-h-10 text-sm">Allow analytics</button>
        <button type="button" onClick={() => choose("declined")} className="btn-line !min-h-10 text-sm">No thanks</button>
      </div>
    </aside>
  );
}
