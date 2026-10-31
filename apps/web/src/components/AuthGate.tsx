"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearSession, hasCompletedOnboarding, refreshSession } from "@/lib/auth";

/**
 * Restores the HttpOnly-cookie session once per page load before showing a signed-in page.
 * Signed-out visitors go to /login; new accounts go through onboarding first (unless this is onboarding).
 */
export default function AuthGate({ children, requireOnboarding = true }: { children: ReactNode; requireOnboarding?: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "jarvis.logout.signal" || !event.newValue) return;
      clearSession();
      router.replace("/login");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((session) => {
      if (cancelled) return;
      if (!session) { router.replace("/login"); return; }
      if (requireOnboarding && !hasCompletedOnboarding()) { router.replace("/onboarding"); return; }
      setReady(true);
    });
    return () => { cancelled = true; };
    // Restore once per page load; refreshing on every navigation would rotate the refresh token needlessly.
  }, []);

  if (!ready) {
    return (
      <main id="main" tabIndex={-1} className="relative z-[1] flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text)]">
        <p role="status" className="caption">Opening your workspace…</p>
      </main>
    );
  }
  return children;
}
