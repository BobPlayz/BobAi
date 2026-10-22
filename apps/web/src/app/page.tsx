"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import JarvisStage from "@/components/core/JarvisStage";
import { Magnetic, Reveal, ScrollProgress, SplitWords } from "@/components/editorial/Motion";
import { useTheme } from "@/components/neural/ThemeProvider";
import type { AssistantVisualState } from "@/lib/assistantState";
import JarvisMark from "@/components/JarvisMark";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Jarvis",
  publisher: { "@type": "Organization", name: "Origin Productions" },
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  description: "A local-first AI assistant that runs on your own computer through Ollama.",
  url: process.env.NEXT_PUBLIC_SITE_URL,
};

const STATES: Array<{ id: AssistantVisualState; label: string; note: string }> = [
  { id: "idle", label: "At rest", note: "The rings drift, like a desk orrery." },
  { id: "listening", label: "Listening", note: "The rings turn to face you and settle." },
  { id: "thinking", label: "Thinking", note: "The gimbals spin like a gyroscope." },
  { id: "speaking", label: "Speaking", note: "The sphere breathes with the voice." },
];

const PRINCIPLES = [
  ["Local first", "The model runs on your own computer through Ollama. Your conversations and files are not sent to an AI company to be answered."],
  ["Honest about the world", "Weather comes from Open-Meteo and says when it was fetched. Scores found by web search are labelled as search results, never passed off as a live feed."],
  ["Asks before it acts", "Anything that acts on your behalf shows you exactly what it will do and waits for your approval. One click, one run."],
  ["Remembers when told", "Say “remember that…” and it will. Everything else is just conversation — it won’t quietly file away what you say."],
];

const CAPABILITIES = [
  ["Conversation & code", "Streaming answers with proper formatting, tables and highlighted code you can copy in one click."],
  ["Live weather", "Current conditions and today’s range for any city, with the time it was measured."],
  ["Research with sources", "Searches the web, reads the pages and lists the sources it used."],
  ["A voice of its own", "Speaks with Alan, a British voice generated on your machine by Piper — no cloud speech service."],
  ["Reads your files", "PDFs, text, code and images, checked on the server before anything is read."],
  ["Draws, slowly", "Local image generation with Stable Diffusion. Free and private, and on a laptop CPU it takes its time."],
];

const SPEC = [
  ["Language model", "Qwen 3.5 via Ollama — 2B for 8 GB laptops, 4B if you have room"],
  ["Context", "4,096 tokens, trimmed to fit instead of silently cut"],
  ["Voice", "Piper · en_GB-alan-medium · runs offline"],
  ["Live data", "Open-Meteo weather · Brave or DuckDuckGo search"],
  ["Accounts", "Email code sign-in via Resend · sessions in Postgres"],
  ["Built for", "An Intel i7 laptop with 8 GB of RAM — no graphics card needed"],
];

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const [figureState, setFigureState] = useState<AssistantVisualState>("idle");
  const [pinned, setPinned] = useState(false);

  // Cycle through the four states so the figure demonstrates itself, until the visitor picks one.
  useEffect(() => {
    if (pinned || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const order: AssistantVisualState[] = ["idle", "listening", "thinking", "speaking"];
    const timer = window.setInterval(() => setFigureState((current) => order[(order.indexOf(current) + 1) % order.length]), 3600);
    return () => window.clearInterval(timer);
  }, [pinned]);

  const active = STATES.find((item) => item.id === figureState)!;

  return (
    <main className="relative z-[1] min-h-screen text-[var(--text)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <ScrollProgress />

      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <nav aria-label="Primary navigation" className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Jarvis home" className="atelier-wordmark"><JarvisMark />Jarvis</Link>
          <div className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
            <a href="#principles" className="hover:text-[var(--text)]">Principles</a>
            <a href="#capabilities" className="hover:text-[var(--text)]">Capabilities</a>
            <a href="#specification" className="hover:text-[var(--text)]">Specification</a>
            <Link href="/demo" className="hover:text-[var(--text)]">Demo</Link>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleTheme} className="atelier-iconbtn" aria-label={theme === "light" ? "Switch to night theme" : "Switch to day theme"}>
              {theme === "light" ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
            </button>
            <Link href="/login" className="btn-ink !min-h-10 !px-4 text-sm">Open Jarvis <span className="btn-arrow" aria-hidden>→</span></Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1320px] gap-10 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-12 lg:gap-6 lg:pb-24 lg:pt-20">
        <div className="lg:col-span-7 lg:pt-6">
          <p className="caption reveal is-in">No. 01 — A personal assistant that lives on your computer</p>
          <h1 className="font-display mt-6 text-[clamp(3.4rem,9.5vw,9.4rem)] leading-[0.9]">
            <SplitWords text="An assistant," start={120} />
            <br />
            <em className="text-[var(--accent)]"><SplitWords text="not an oracle." start={360} /></em>
          </h1>
          <Reveal delay={700} className="mt-8 max-w-[34rem]">
            <p className="text-lg leading-8 text-[var(--muted)] sm:text-xl sm:leading-9">
              Jarvis is a calm, local-first assistant. It thinks on your own machine, says where its facts come from, and asks before it does anything on your behalf.
            </p>
          </Reveal>
          <Reveal delay={850} className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic><Link href="/login" className="btn-ink">Start a conversation <span className="btn-arrow" aria-hidden>→</span></Link></Magnetic>
            <Magnetic><Link href="/demo" className="btn-line">See the demo</Link></Magnetic>
          </Reveal>
          <Reveal delay={950}><p className="caption mt-6 normal-case tracking-normal">Sign in with a one-time email code. No password.</p></Reveal>
        </div>

        <figure className="lg:col-span-5">
          <div
            className="relative mx-auto w-full max-w-[520px]"
            onPointerEnter={() => { if (!pinned) setFigureState("listening"); }}
          >
            <JarvisStage hero stateOverride={figureState} label={active.label} />
          </div>
          <figcaption className="mx-auto mt-4 max-w-[520px] border-t border-[var(--hairline)] pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="caption">Fig. 1 — The Jarvis core</span>
              <span className="caption" aria-live="polite">{active.label}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{active.note}</p>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Show a state">
              {STATES.map((item) => (
                <button key={item.id} type="button" aria-pressed={figureState === item.id} className="atelier-chip" onClick={() => { setPinned(true); setFigureState(item.id); }}>
                  {item.label}
                </button>
              ))}
            </div>
          </figcaption>
        </figure>
      </section>

      {/* Marquee */}
      <div className="border-y border-[var(--text)] bg-[var(--text)] py-4 text-[var(--bg)]">
        <div className="marquee" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div key={copy} className="marquee-track font-display text-3xl sm:text-4xl">
              {["Runs on Ollama", "Speaks with Alan", "Keeps your files local", "Cites its sources", "Asks before it acts", "Works on an 8 GB laptop"].map((item) => (
                <span key={item} className="flex items-center gap-12 whitespace-nowrap">{item}<span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" aria-hidden /></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Principles */}
      <section id="principles" aria-labelledby="principles-title" className="mx-auto grid max-w-[1320px] gap-10 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-36">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <p className="caption">02 — Principles</p>
            <h2 id="principles-title" className="font-display mt-4 text-5xl leading-[0.95] sm:text-6xl">Four promises,<br /><em>kept in code.</em></h2>
          </div>
        </div>
        <ol className="lg:col-span-8 lg:col-start-6">
          {PRINCIPLES.map(([title, body], index) => (
            <Reveal key={title} as="li" delay={index * 60} className="grid grid-cols-[3.5rem_1fr] gap-4 border-t border-[var(--hairline)] py-9 sm:grid-cols-[5rem_1fr]">
              <span className="font-display text-4xl text-[var(--accent)] sm:text-5xl">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="font-display text-3xl sm:text-4xl">{title}</h3>
                <p className="mt-3 max-w-[38rem] text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">{body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Capabilities */}
      <section id="capabilities" aria-labelledby="capabilities-title" className="border-t border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 lg:py-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="caption">03 — What it does</p>
              <h2 id="capabilities-title" className="font-display mt-4 max-w-3xl text-5xl leading-[0.95] sm:text-7xl">Useful, in plain terms.</h2>
            </div>
            <p className="max-w-sm text-[var(--muted)]">No sparkles, no superlatives. Here is what Jarvis actually does today, and where it is slow.</p>
          </div>
          <div className="mt-16 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(([title, body], index) => (
              <Reveal key={title} delay={(index % 3) * 90} className="group border-t border-[var(--text)] py-8">
                <div className="flex items-baseline justify-between">
                  <span className="caption">{String.fromCharCode(97 + index)}.</span>
                  <span aria-hidden className="text-[var(--accent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100">→</span>
                </div>
                <h3 className="font-display mt-6 text-3xl transition-transform duration-700 group-hover:translate-x-2">{title}</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Specification */}
      <section id="specification" aria-labelledby="spec-title" className="mx-auto grid max-w-[1320px] gap-10 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-36">
        <div className="lg:col-span-4">
          <p className="caption">04 — Specification</p>
          <h2 id="spec-title" className="font-display mt-4 text-5xl leading-[0.95] sm:text-6xl">The fine print,<br /><em>printed large.</em></h2>
        </div>
        <dl className="lg:col-span-8 lg:col-start-6">
          {SPEC.map(([term, detail], index) => (
            <Reveal key={term} delay={index * 50} className="grid gap-1 border-t border-[var(--hairline)] py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="caption pt-1">{term}</dt>
              <dd className="text-lg">{detail}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      {/* Closing */}
      <section className="border-t border-[var(--text)]">
        <div className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <h2 className="font-display text-[clamp(4rem,15vw,14rem)] leading-[0.85]">Talk to it<em className="text-[var(--accent)]">.</em></h2>
          </Reveal>
          <Reveal delay={150} className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic><Link href="/login" className="btn-ink">Open Jarvis <span className="btn-arrow" aria-hidden>→</span></Link></Magnetic>
            <Magnetic><Link href="/demo" className="btn-line">Try the demo first</Link></Magnetic>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-[var(--muted)] sm:px-8">
          <span>Jarvis — Origin Productions</span>
          <nav aria-label="Footer" className="flex gap-6">
            <Link href="/about" className="hover:text-[var(--text)]">About</Link>
            <Link href="/faq" className="hover:text-[var(--text)]">FAQ</Link>
            <Link href="/privacy" className="hover:text-[var(--text)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--text)]">Terms</Link>
          </nav>
          <span className="caption normal-case tracking-normal">Set in Bricolage Grotesque &amp; Plus Jakarta Sans.</span>
        </div>
      </footer>
    </main>
  );
}
