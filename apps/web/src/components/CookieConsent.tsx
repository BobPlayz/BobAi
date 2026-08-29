"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const STORAGE_KEY = "bobai-analytics-consent";

export default function CookieConsent() {
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    setConsent(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  if (consent === "accepted") {
    const analyticsUrl = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
    const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN;
    return analyticsUrl ? <Script defer data-domain={siteDomain} src={`${analyticsUrl.replace(/\/$/, "")}/js/script.js`} /> : null;
  }

  if (consent === "declined") return null;

  const choose = (value: "accepted" | "declined") => {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  };

  return (
    <aside className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl" aria-label="Analytics consent">
      <p className="text-sm leading-6 text-white/70">Bob AI can use privacy-conscious analytics to understand how the site is used. No analytics are loaded unless you allow them.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => choose("accepted")} className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Allow analytics</button>
        <button onClick={() => choose("declined")} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white">No thanks</button>
      </div>
    </aside>
  );
}
