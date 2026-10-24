import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = {
  title: "About",
  description: "What Jarvis is, how it works, and who builds it.",
};

const parts = [
  ["Open models", "Every answer comes from open AI models through Ollama. No secret third-party AI."],
  ["Shows its sources", "Research, weather and cricket answers say where the facts came from and when they were fetched."],
  ["Asks first", "Anything that acts for you, like running a tool, waits for your approval."],
] as const;

export default function AboutPage() {
  return (
    <main id="main" tabIndex={-1} className="relative z-[1] min-h-screen px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs current="About" />
        <h1 className="font-display mt-6 text-6xl leading-none">About <em className="text-[var(--accent)]">Jarvis.</em></h1>
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
          Jarvis is a chill personal assistant for chat, research, voice, pictures, coding and files, in your language. It is a school project by a Class 8 student, built and published by Origin Productions.
        </p>
        <div className="mt-12 grid gap-8 border-t border-[var(--hairline)] pt-8 sm:grid-cols-3">
          {parts.map(([title, text]) => (
            <section key={title}>
              <h2 className="font-display text-2xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
            </section>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/demo" className="btn-ink">Try the demo <span className="btn-arrow" aria-hidden>→</span></Link>
          <Link href="/contact" className="btn-line">Contact</Link>
        </div>
      </div>
    </main>
  );
}
