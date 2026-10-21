"use client";

import Link from "next/link";
import { useTheme } from "@/components/neural/ThemeProvider";

const features = [
  ["01", "Chat", "Think, write, code, plan and explore in one focused workspace."],
  ["02", "Memory", "Keep useful context across conversations, ready when you need it."],
  ["03", "Tools", "Bring files, research and creative work into the same flow."],
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Jarvis",
  publisher: { "@type": "Organization", name: "Origin Productions" },
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  description: "A focused AI workspace for conversations, memory, files, research and tools.",
  url: process.env.NEXT_PUBLIC_SITE_URL,
};

export default function HomePage() {
  const { theme } = useTheme();
  const light = theme === "light";
  return (
    <main className={`relative min-h-screen overflow-hidden ${light ? "bg-[#f7f8fa] text-[#202123]" : "bg-[#07090c] text-white"}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      {!light && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(61,220,255,0.12),transparent_42%),radial-gradient(circle_at_90%_70%,rgba(45,110,255,0.07),transparent_32%)]" />}
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 sm:px-10">
        <header className={`flex items-center justify-between border-b py-5 ${light ? "border-[#e5e7eb]" : "border-white/10"}`}>
          <Link href="/" aria-label="Jarvis home" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 font-black text-cyan-500">J</span>
            <span className="font-semibold tracking-tight">Jarvis</span>
          </Link>
          <nav aria-label="Primary navigation" className={`hidden items-center gap-7 text-sm md:flex ${light ? "text-[#6b7280]" : "text-white/55"}`}>
            <a href="#features" className="transition hover:text-cyan-400">Features</a>
            <Link href="/terms" className="transition hover:text-cyan-400">Terms</Link>
            <Link href="/privacy" className="transition hover:text-cyan-400">Privacy</Link>
          </nav>
          <Link href="/login" className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${light ? "border-[#d1d5db] bg-white hover:bg-[#f3f4f6]" : "border-white/15 bg-white/[0.04] hover:border-cyan-300/40 hover:bg-white/[0.08]"}`}>Get started</Link>
        </header>

        <section className="flex flex-1 items-center py-20 sm:py-28">
          <div className="max-w-3xl">
            <div className={`mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${light ? "border-cyan-700/20 bg-cyan-700/5 text-cyan-800" : "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-200"}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Your AI workspace
            </div>
            <h1 className="text-5xl font-black leading-[1.05] tracking-[-0.045em] sm:text-7xl">A little more room for <span className="text-cyan-400">big ideas.</span></h1>
            <p className={`mt-6 max-w-2xl text-base leading-7 sm:text-lg ${light ? "text-[#5f6672]" : "text-white/55"}`}>Chat, research, create and pick up where you left off. Jarvis brings your AI work together in one calm, focused space.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/login" className="rounded-2xl bg-cyan-300 px-6 py-3.5 font-bold text-[#071015] transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">Continue with email <span aria-hidden="true">↗</span></Link>
              <a href="#features" className={`rounded-2xl border px-6 py-3.5 text-sm font-semibold transition ${light ? "border-[#d1d5db] hover:bg-white" : "border-white/10 hover:border-white/20 hover:bg-white/[0.04]"}`}>Explore features</a>
            </div>
            <p className={`mt-5 text-xs ${light ? "text-[#7b818b]" : "text-white/35"}`}>No password to remember. Just your email.</p>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className={`grid gap-3 border-t py-8 md:grid-cols-3 ${light ? "border-[#e5e7eb]" : "border-white/10"}`}>
          <h2 id="features-heading" className="sr-only">Jarvis features</h2>
          {features.map(([number, title, description]) => (
            <article key={number} className={`rounded-2xl border p-5 transition-colors ${light ? "border-[#e5e7eb] bg-white hover:border-cyan-700/25" : "border-white/10 bg-white/[0.025] hover:border-cyan-300/20"}`}>
              <span className="text-xs font-medium tracking-[0.16em] text-cyan-500">{number}</span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className={`mt-2 text-sm leading-6 ${light ? "text-[#6b7280]" : "text-white/45"}`}>{description}</p>
            </article>
          ))}
        </section>
        <footer className={`flex flex-wrap items-center justify-between gap-3 border-t py-5 text-xs ${light ? "border-[#e5e7eb] text-[#7b818b]" : "border-white/10 text-white/35"}`}>
          <span>Jarvis · Origin Productions</span>
          <span>Built to keep your work in flow.</span>
        </footer>
      </div>
    </main>
  );
}
