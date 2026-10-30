"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import JarvisStage from "@/components/core/JarvisStage";
import { Magnetic, Reveal, ScrollProgress, SplitWords } from "@/components/editorial/Motion";
import { useTheme } from "@/components/neural/ThemeProvider";
import type { AssistantVisualState } from "@/lib/assistantState";
import JarvisMark from "@/components/JarvisMark";
import { siteUrl } from "@/lib/siteUrl";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Jarvis",
  publisher: { "@type": "Organization", name: "Origin Productions" },
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, Android, iOS",
  description: "A free AI assistant that shows its sources, builds simple websites for you, reads files and photos, talks back, and asks before doing stuff.",
  url: siteUrl(),
  inLanguage: ["en", "te", "hi"],
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: ["AI chat", "Live news and weather with sources", "Website builder with live preview", "File and photo understanding", "Voice conversations", "Pictures with answers", "Asks before acting"],
};

const STATES: Array<{ id: AssistantVisualState; label: string; note: string }> = [
  { id: "idle", label: "At rest", note: "Just vibing. The rings drift around." },
  { id: "listening", label: "Listening", note: "The rings turn to face you. It's all ears." },
  { id: "thinking", label: "Thinking", note: "Big brain time. Everything spins." },
  { id: "speaking", label: "Speaking", note: "The ball pulses while it talks." },
];

const PRINCIPLES = [
  ["Works anywhere", "Open it in any browser on your phone, tablet or laptop. Nothing to install, and you can add it to your home screen."],
  ["No making stuff up", "Weather comes from a real weather service and says when it was checked. Cricket scores from a web search are labelled as search results, not fake live scores."],
  ["Asks first", "If Jarvis wants to actually do something for you, it shows you exactly what and waits for you to say yes."],
  ["Only remembers what you ask", "Say “remember that…” and it will. Everything else is just chat. No secret note-taking."],
];

const CAPABILITIES = [
  ["Chat, code & websites", "Answers type out live. Ask for a calculator or a game and press Preview to play with it right in the chat."],
  ["Live scores & weather", "Real cricket scores and weather, with where they came from. Never made up."],
  ["Research with sources", "Searches the web, reads the pages, and shows you where it got everything."],
  ["Talk mode", "Just talk. Jarvis listens, answers out loud and keeps the convo going, hands-free."],
  ["Reads your files", "Drop in PDFs, notes, code or pics and ask about them. Files get safety-checked first."],
  ["Draws pictures", "Describe it and Jarvis draws it, for free. In 24 languages, texting the way your generation does."],
];

const SPEC = [
  ["AI model", "Ollama Cloud: picks the best model for each task and switches if one is down"],
  ["Memory span", "Long chats get summarized, so the important bits stick around"],
  ["Voice", "ElevenLabs when it’s on, your browser’s voice when it’s not · Piper offline on a PC"],
  ["Live stuff", "Open-Meteo weather · Brave or DuckDuckGo search · cricket"],
  ["Sign in", "6-digit email code, no passwords · chats saved in Postgres"],
  ["Made on", "A school laptop with 8 GB of RAM. No fancy graphics card needed"],
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
    <main id="main" tabIndex={-1} className="relative z-[1] min-h-screen text-[var(--text)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <ScrollProgress />

      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <nav aria-label="Primary navigation" className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Jarvis home" className="atelier-wordmark"><JarvisMark />Jarvis</Link>
          <div className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
            <a href="#principles" className="hover:text-[var(--text)]">The rules</a>
            <a href="#capabilities" className="hover:text-[var(--text)]">What it does</a>
            <a href="#specification" className="hover:text-[var(--text)]">Nerdy bits</a>
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
          <p className="caption reveal is-in">No. 01 — Your own AI sidekick</p>
          <h1 className="font-display mt-6 pb-2 text-[clamp(3.4rem,9.5vw,9.4rem)] leading-[1.05]">
            <SplitWords text="An assistant," start={120} />
            <br />
            <em className="text-[var(--accent)]"><SplitWords text="not a guru." start={360} /></em>
          </h1>
          <Reveal delay={700} className="mt-8 max-w-[34rem]">
            <p className="text-lg leading-8 text-[var(--muted)] sm:text-xl sm:leading-9">
              Jarvis is a chill AI you can actually trust. It shows where its facts come from, doesn’t make up live scores, and always asks before doing stuff for you.
            </p>
          </Reveal>
          <Reveal delay={850} className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic><Link href="/login" className="btn-ink">Start a conversation <span className="btn-arrow" aria-hidden>→</span></Link></Magnetic>
            <Magnetic><Link href="/demo" className="btn-line">See the demo</Link></Magnetic>
          </Reveal>
          <Reveal delay={950}><p className="caption mt-6 normal-case tracking-normal">Sign in with a code sent to your email. No passwords to forget.</p></Reveal>
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
              {["Works anywhere", "Talks like Alan", "Shows its sources", "Asks first", "No made-up facts", "Reads your files"].map((item) => (
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
            <p className="caption">02 — The rules</p>
            <h2 id="principles-title" className="font-display mt-4 text-5xl leading-[0.95] sm:text-6xl">Four rules<br /><em>it never breaks.</em></h2>
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
              <h2 id="capabilities-title" className="font-display mt-4 max-w-3xl text-5xl leading-[0.95] sm:text-7xl">What it can actually do.</h2>
            </div>
            <p className="max-w-sm text-[var(--muted)]">No hype. Here’s what Jarvis really does right now, and the bits that are slow.</p>
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
          <p className="caption">04 — Nerdy bits</p>
          <h2 id="spec-title" className="font-display mt-4 text-5xl leading-[0.95] sm:text-6xl">The nerdy bits,<br /><em>for the curious.</em></h2>
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
            <h2 className="font-display text-[clamp(4rem,15vw,14rem)] leading-[0.85]">Say hi<em className="text-[var(--accent)]">.</em></h2>
          </Reveal>
          <Reveal delay={150} className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic><Link href="/login" className="btn-ink">Open Jarvis <span className="btn-arrow" aria-hidden>→</span></Link></Magnetic>
            <Magnetic><Link href="/demo" className="btn-line">Try the demo first</Link></Magnetic>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-[var(--muted)] sm:px-8">
          <span>Jarvis · made by a Class 8 student · Origin Productions</span>
          <nav aria-label="Footer" className="-my-3 flex gap-2">
            <Link href="/about" className="inline-flex min-h-11 items-center px-2 hover:text-[var(--text)]">About</Link>
            <Link href="/faq" className="inline-flex min-h-11 items-center px-2 hover:text-[var(--text)]">FAQ</Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center px-2 hover:text-[var(--text)]">Privacy</Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center px-2 hover:text-[var(--text)]">Terms</Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center px-2 hover:text-[var(--text)]">Contact</Link>
          </nav>
          <span className="caption normal-case tracking-normal">Set in Instrument Serif &amp; Schibsted Grotesk.</span>
        </div>
      </footer>
    </main>
  );
}
