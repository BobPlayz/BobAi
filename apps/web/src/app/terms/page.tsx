import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description: "The rules for using Jarvis, in plain words.",
};

const UPDATED = "October 23, 2026";

const sections: Array<[string, string]> = [
  ["What Jarvis is", "Jarvis is a free AI assistant made as a school project by BobPlayz (Origin Productions). It chats, helps with code, looks up weather, cricket and the web, reads files you share, and can remember things you ask it to. Features can change, and it may sometimes be offline."],
  ["Who can use it", "Anyone who agrees to these terms. If you are under 18, use Jarvis only with a parent or guardian's permission."],
  ["Your account", "You sign in with a code sent to your email, or as a guest without one. Keep your email account safe, don't share codes, and only use your own account. Don't try to get into anyone else's account or data. Guest accounts can't be recovered once you log out."],
  ["AI can be wrong", "Jarvis's answers come from AI models and can be wrong, out of date or made up, even when they sound confident. Check anything important (homework, health, money, safety) with a trusted source or adult. Live data like weather and cricket shows where it came from; web answers list their sources."],
  ["Be decent", "Don't use Jarvis to bully or harass anyone, break the law, create harmful or adult content, spread malware, spam, or attack the service. Don't paste other people's private information. Jarvis may refuse requests that break these rules."],
  ["Your stuff", "What you write and upload stays yours. You let Jarvis process it only to answer you and keep your history. Only upload things you're allowed to share."],
  ["Actions need your OK", "If Jarvis wants to do something for you with a tool, it shows you exactly what and waits for your approval. You're responsible for what you approve."],
  ["Other services", "Jarvis uses other services to work: Vercel (hosting), Neon (database), Ollama (AI models), Gmail or Resend (login codes), Pollinations (pictures), ElevenLabs (voice, when turned on), and weather, search and cricket providers. Their own terms apply to them."],
  ["No guarantees", "Jarvis is provided free and \"as is\". It might be unavailable, slow, or lose data, and it isn't a replacement for professional advice. As far as the law allows, the maker isn't responsible for losses from using it."],
  ["Ending things", "You can delete your account any time in Settings. Accounts that break these rules may be limited or removed."],
  ["Changes", "These terms may be updated; the date at the top will change. Continuing to use Jarvis after a change means you accept it."],
];

export default function TermsPage() {
  return (
    <main id="main" tabIndex={-1} className="relative z-[1] mx-auto min-h-screen max-w-3xl px-5 pb-20 pt-28 text-[var(--text)] sm:px-8">
      <p className="text-sm text-[var(--muted)]">Last updated: {UPDATED}</p>
      <h1 className="font-display mt-3 text-6xl leading-none">Terms<em className="text-[var(--accent)]">.</em></h1>
      <p className="mt-4 leading-7 text-[var(--muted)]">The short version: be nice, double-check important answers, and only use your own account. The details:</p>
      <div className="mt-10 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
        {sections.map(([title, body], index) => (
          <section key={title} className="py-5">
            <h2 className="font-display text-2xl">{index + 1}. {title}</h2>
            <p className="mt-2 leading-7 text-[var(--muted)]">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 leading-7 text-[var(--muted)]">
        How your data is handled: <Link href="/privacy" className="md-link">Privacy Policy</Link>. Questions: <Link href="/contact" className="md-link">contact</Link>.
      </p>
    </main>
  );
}
