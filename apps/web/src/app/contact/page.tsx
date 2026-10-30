import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = { title: "Contact", description: "How to reach the Jarvis project." };

export default function ContactPage() {
  return (
    <main id="main" tabIndex={-1} className="relative z-[1] min-h-screen px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs current="Contact" />
        <h1 className="font-display mt-6 text-6xl leading-none">Say hi<em className="text-[var(--accent)]">.</em></h1>
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
          Have a question, spotted something that needs fixing, or have an idea for Jarvis? Send a message using the contact details below.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a href="https://github.com/BobPlayz/BobAi/issues/new" target="_blank" rel="noopener noreferrer" className="btn-ink">Open an issue <span className="btn-arrow" aria-hidden>→</span></a>
          <Link href="/demo" className="btn-line">Try the demo</Link>
        </div>
      </div>
    </main>
  );
}
