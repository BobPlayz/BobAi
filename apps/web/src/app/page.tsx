"use client";

import Link from "next/link";
import { useTheme } from "@/components/neural/ThemeProvider";

const features = [
  ["01", "Chat", "Think, write, code, plan and explore in one workspace."],
  ["02", "Memory", "Keep useful context across conversations without the clutter."],
  ["03", "Tools", "Work with files, research, projects and connected capabilities."],
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Bob AI",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "An AI workspace for chat, research, creation, development, memory, files, tools, agents, and automations.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://bobai.app",
};

export default function HomePage() {
  const { theme } = useTheme();
  const light = theme === "light";
  return (
    <main className={`min-h-screen overflow-hidden ${light ? "bg-[#f7f8fa] text-[#202123]" : "bg-[#07090c] text-white"}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      {!light && <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(61,220,255,0.12),transparent_38%),radial-gradient(circle_at_90%_70%,rgba(45,110,255,0.08),transparent_30%)]" />}
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 sm:px-10">
        <header className={`flex items-center justify-between border-b py-5 ${light ? "border-[#e5e7eb]" : "border-white/8"}`}>
          <Link href="/" aria-label="Bob AI home" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 font-black text-cyan-600">B</span>
            <span className="font-semibold tracking-tight">Bob AI</span>
          </Link>
          <nav aria-label="Primary navigation" className={`hidden items-center gap-7 text-sm md:flex ${light ? "text-[#6b7280]" : "text-white/45"}`}>
            <a href="#features" className={light ? "hover:text-black" : "hover:text-white"}>features</a>
            <Link href="/terms" className="hover:text-white">terms</Link>
            <Link href="/privacy" className="hover:text-white">privacy</Link>
          </nav>
          <Link href="/login" className={`rounded-xl border px-4 py-2 text-sm font-semibold ${light ? "border-[#d1d5db] bg-white hover:bg-[#f3f4f6]" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"}`}>get started</Link>
        </header>
        <section className="flex flex-1 items-center py-20 sm:py-28">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-sky-700">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> AI workspace
            </div>
            <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl">One clean place for <span className="text-cyan-300">your AI work.</span></h1>
            <p className={`mt-6 max-w-2xl text-base leading-7 sm:text-lg ${light ? "text-[#5f6672]" : "text-white/50"}`}>BobAI brings conversations, memory, projects, files and tools into one focused workspace. No fake chat wall. No dashboard soup.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-2xl bg-cyan-300 px-6 py-3.5 font-bold text-black transition hover:bg-cyan-200">get started with email</Link>
            </div>
            <p className={`mt-5 text-xs ${light ? "text-[#6b7280]" : "text-white/30"}`}>Built for focused work. Your workspace starts when you do.</p>
          </div>
        </section>
        <section id="features" aria-labelledby="features-heading" className={`grid gap-3 border-t py-8 md:grid-cols-3 ${light ? "border-[#e5e7eb]" : "border-white/8"}`}>
          <h2 id="features-heading" className="sr-only">Bob AI features</h2>
          {features.map(([number, title, text]) => <div key={number} className={`rounded-2xl border p-5 ${light ? "border-[#e5e7eb] bg-white" : "border-white/8 bg-white/[0.025]"}`} title={`${title}: ${text}`}><span className="text-xs text-sky-600">{number}</span><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className={`mt-2 text-sm leading-6 ${light ? "text-[#6b7280]" : "text-white/40"}`}>{text}</p></div>)}
        </section>
      </div>
    </main>
  );
}
