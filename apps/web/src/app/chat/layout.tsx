"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasCompletedOnboarding, refreshSession } from "@/lib/auth";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      // Restore the existing secure, HttpOnly-cookie session after a reload
      // before deciding whether the user needs to sign in again.
      const session = await refreshSession();
      if (cancelled) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      if (!hasCompletedOnboarding() && pathname !== "/onboarding") {
        router.replace("/onboarding");
        return;
      }

      setSessionChecked(true);
    }

    void restoreSession();
    return () => { cancelled = true; };
    // Restore once per page load. Re-running on every pathname change rotated the refresh token needlessly.
  }, []);

  if (!sessionChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080a0d] text-cyan-200">
        <p role="status" className="text-sm tracking-wide">Restoring your JARVIS session…</p>
      </main>
    );
  }

  return children;
}
