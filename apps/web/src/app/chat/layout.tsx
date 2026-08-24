"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasCompletedOnboarding, isLoggedIn } from "@/lib/auth";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
    else if (!hasCompletedOnboarding() && pathname !== "/onboarding") router.replace("/onboarding");
  }, [pathname, router]);

  return children;
}