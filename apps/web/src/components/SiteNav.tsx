"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/neural/ThemeProvider";
import JarvisMark from "@/components/JarvisMark";

const links = [
  ["About", "/about"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
] as const;

/** Header for the information pages. The home, chat and demo pages have their own headers. */
export default function SiteNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  if (!links.some(([, href]) => href === pathname)) return null;
  const light = theme === "light";
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/90 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8" aria-label="Primary navigation">
        <Link href="/" className="atelier-wordmark" aria-label="Jarvis home"><JarvisMark />Jarvis</Link>
        <div className="hidden items-center gap-6 text-sm sm:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "text-[var(--text)] underline decoration-[var(--accent)] underline-offset-4" : "text-[var(--muted)] hover:text-[var(--text)]"}>{label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <details className="relative sm:hidden">
            <summary className="atelier-chip cursor-pointer list-none">Menu</summary>
            <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow)]">
              {links.map(([label, href]) => <Link key={href} href={href} className="block rounded-xl px-3 py-2 text-sm hover:bg-[var(--surface-2)]">{label}</Link>)}
            </div>
          </details>
          <button type="button" onClick={toggleTheme} className="atelier-iconbtn" aria-label={light ? "Switch to night theme" : "Switch to day theme"}>
            {light ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
          </button>
          <Link href="/chat" className="btn-ink !min-h-10 !px-4 text-sm">Open Jarvis</Link>
        </div>
      </nav>
    </header>
  );
}
