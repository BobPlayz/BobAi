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
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 shadow-lg backdrop-blur-xl" aria-label="Primary navigation">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Bob AI home">
          <span className="grid size-8 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-sm text-cyan-200" aria-hidden="true">B</span>
          <span>Bob AI</span>
        </Link>
        <div className="hidden items-center gap-1 sm:flex">
          {links.slice(1, 5).map(([label, href]) => (
            <Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/8 hover:text-white">{label}</Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <details className="relative sm:hidden">
            <summary className="cursor-pointer list-none rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70">Menu</summary>
            <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl">
              {links.slice(1).map(([label, href]) => <Link key={href} href={href} className="block rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">{label}</Link>)}
            </div>
          </details>
          <Link href="/chat" className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.2)] hover:-translate-y-0.5">Try Bob AI</Link>
        </div>
      </nav>
    </header>
  );
}
