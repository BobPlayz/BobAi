import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description: "What Jarvis collects, where it goes, how long it is kept, and how to delete it.",
};

const UPDATED = "October 23, 2026";

const collected: Array<[string, string]> = [
  ["Your name and email", "To sign you in with a 6-digit code and to greet you. Login codes are stored scrambled (hashed), expire after 10 minutes and are deleted after use."],
  ["Your chats", "Your messages and Jarvis's replies are saved to your account so you can come back to them. You can delete single messages or whole chats."],
  ["Memories", "Only things you ask Jarvis to remember (\"remember that…\"). Jarvis refuses to save passwords or codes. You can view, edit and clear memories in Settings."],
  ["Your generation", "If you tell Jarvis your birth year, it keeps only your generation (for example \"Gen Z\") to choose a texting style. The year itself is never saved or sent."],
  ["Your texting style", "If \"Learn how I type\" is on, Jarvis keeps a small style profile: numbers like average message length and how often you use lowercase or emoji, plus a short list of common slang words you use. It never stores your messages for this. You can turn it off or reset it in Settings."],
  ["Files you upload", "Used to answer questions about them. Images are deleted after 30 days and documents after 90 days."],
  ["Sign-in and security data", "A session cookie that keeps you signed in, scrambled session tokens, and short-lived request counts used to stop spam and attacks."],
];

const services: Array<[string, string]> = [
  ["Vercel", "Hosts the website and API. Processes requests and keeps short technical logs."],
  ["Neon", "The database where your account, chats, memories and settings are stored."],
  ["Ollama (Ollama Cloud, or Ollama on the owner's computer)", "Writes Jarvis's replies. Your messages, and the context needed to answer them, are sent to the model for each reply. Ollama Cloud says it does not train on these prompts."],
  ["Gmail or Resend", "Sends your login code. They receive your email address and the code."],
  ["Open-Meteo, DuckDuckGo or Brave Search, CricketData.org", "Only when you ask for weather, a web search or cricket scores. They receive the place name or search words, not your account details."],
];

export default function PrivacyPage() {
  return (
    <main id="main" tabIndex={-1} className="relative z-[1] mx-auto min-h-screen max-w-3xl px-5 pb-20 pt-28 text-[var(--text)] sm:px-8">
      <p className="text-sm text-[var(--muted)]">Last updated: {UPDATED}</p>
      <h1 className="font-display mt-3 text-6xl leading-none">Privacy<em className="text-[var(--accent)]">.</em></h1>
      <p className="mt-4 leading-7 text-[var(--muted)]">
        Jarvis is a school project by BobPlayz (Origin Productions). This page explains, in plain words, what Jarvis collects, why, who else sees it, and how to delete it. There are no ads, nothing is sold, and no tracking analytics are used.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-3xl">What Jarvis keeps and why</h2>
        <dl className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {collected.map(([term, detail]) => (
            <div key={term} className="py-4"><dt className="font-medium">{term}</dt><dd className="mt-1 leading-7 text-[var(--muted)]">{detail}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-3xl">Services that help run Jarvis</h2>
        <dl className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
          {services.map(([term, detail]) => (
            <div key={term} className="py-4"><dt className="font-medium">{term}</dt><dd className="mt-1 leading-7 text-[var(--muted)]">{detail}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mt-10 space-y-4 leading-7 text-[var(--muted)]">
        <h2 className="font-display text-3xl text-[var(--text)]">Cookies and your browser</h2>
        <p>One sign-in cookie is needed to keep you logged in. Your theme, generation and chat preferences are saved in your own browser. Optional analytics would only load if you said yes to them, and they are currently not set up at all.</p>

        <h2 className="font-display pt-4 text-3xl text-[var(--text)]">Under 18?</h2>
        <p>Jarvis is made by a student and may be used by young people. If you are under 18, please use Jarvis only with a parent or guardian&apos;s permission, and don&apos;t share private information about yourself or others in chats. Parents or guardians can ask for a child&apos;s account to be deleted using the contact link below.</p>

        <h2 className="font-display pt-4 text-3xl text-[var(--text)]">Your choices</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-[var(--text)]">See and download your data:</strong> Settings → Privacy → export.</li>
          <li><strong className="text-[var(--text)]">Delete things:</strong> delete messages, chats and memories any time; reset your texting style in Settings.</li>
          <li><strong className="text-[var(--text)]">Delete your account:</strong> Settings → Privacy, confirmed with an email code. The account stops working straight away and is permanently deleted after 30 days.</li>
          <li><strong className="text-[var(--text)]">Turn things off:</strong> memory and &quot;Learn how I type&quot; can be switched off in Settings.</li>
        </ul>

        <h2 className="font-display pt-4 text-3xl text-[var(--text)]">Keeping it safe</h2>
        <p>Connections are encrypted (HTTPS), codes and tokens are stored scrambled, every account can only see its own data, and the server blocks requests from other websites. No system is perfect, so please don&apos;t put passwords, bank details or ID numbers into chats.</p>

        <h2 className="font-display pt-4 text-3xl text-[var(--text)]">Contact</h2>
        <p>Questions, corrections or deletion requests: <Link href="/contact" className="md-link">contact page</Link>. Please don&apos;t post private details in a public issue; say you have a privacy request and we&apos;ll reply.</p>

        <h2 className="font-display pt-4 text-3xl text-[var(--text)]">Changes</h2>
        <p>If this page changes, the date at the top changes too. Big changes will be shown in the app before they apply.</p>
      </section>
    </main>
  );
}
