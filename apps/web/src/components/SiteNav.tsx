import Link from "next/link";

const links = [
  ["Home", "/"],
  ["About", "/about"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
  ["Waitlist", "/waitlist"],
] as const;

export default function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 shadow-lg backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Bob AI home">
          <span className="grid size-8 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-sm text-cyan-200">B</span>
          <span>Bob AI</span>
        </Link>
        <div className="hidden items-center gap-1 sm:flex" aria-label="Primary navigation">
          {links.slice(1, 5).map(([label, href]) => (
            <Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/8 hover:text-white">
              {label}
            </Link>
          ))}
        </div>
        <Link href="/chat" className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.2)] hover:-translate-y-0.5">
          Try Bob AI
        </Link>
      </nav>
    </header>
  );
}
