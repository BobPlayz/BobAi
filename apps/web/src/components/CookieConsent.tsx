"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useTheme } from "@/components/neural/ThemeProvider";

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
  const { theme } = useTheme();
  const light = theme === "light";
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
    <aside className={`fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-xl rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${light ? "border-[#e5e7eb] bg-white/95 text-[#202123]" : "border-white/10 bg-slate-950/90 text-white"}`} aria-label="Analytics consent">
      <p className={`text-sm leading-6 ${light ? "text-[#4b5563]" : "text-white/70"}`}>Jarvis uses strictly necessary authentication cookies to keep you signed in. Optional privacy-conscious analytics are separate and are never loaded unless you allow them.</p>
      <div className={`mt-2 text-xs ${light ? "text-[#6b7280]" : "text-white/45"}`}>Read the <a href="/privacy" className="text-sky-600 hover:text-sky-700">Privacy Policy</a> before choosing.</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => choose("accepted")} className="btn-ink !min-h-10 text-sm">Allow analytics</button>
        <button onClick={() => choose("declined")} className={`rounded-xl border px-4 py-2 text-sm ${light ? "border-[#d1d5db] text-[#4b5563] hover:text-[#111827]" : "border-white/10 text-white/70 hover:text-white"}`}>No thanks</button>
      </div>
    </aside>
  );
}
