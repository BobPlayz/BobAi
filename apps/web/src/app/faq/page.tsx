import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = { title: "FAQ", description: "Frequently asked questions about Jarvis." };

const faqs = [
  ["What is Jarvis?", "A free AI assistant for chatting, homework and coding help, research with sources, live weather and cricket, pictures, voice chat, and memory you control."],
  ["Which AI does it use?", "Chat answers come only from Ollama models (on Ollama Cloud or the owner's computer). Pictures come from Pollinations, and the natural voice (when it's on) from ElevenLabs."],
  ["How do I sign in?", "Type your email and Jarvis sends a 6-digit code. There are no passwords. Codes expire after 10 minutes and work once."],
  ["How do I log out?", "Tap Log out at the bottom of the chat sidebar, or go to Settings → Privacy, where you can also log out on all your devices."],
  ["Can I talk to it?", "Yes. Tap Talk in the chat for a hands-free voice conversation: just speak, Jarvis answers out loud when you pause. It works best in Chrome, Edge or Safari."],
  ["Can it reply in my language?", "Yes. Pick a reply language when you set up, or any time in Settings. Jarvis sticks to it unless you ask for a translation."],
  ["Can it build websites?", "Ask for something like \"a simple calculator website\" and press Preview to try it right in the chat, or Download to keep it. On a computer running Jarvis locally, ask for it \"on localhost\" and it hosts it for you."],
  ["Does it remember things?", "Only when you ask, for example \"remember that my cat is called Max\". You can see and delete everything it knows about you in Settings → What I know."],
  ["Is there a limit?", "Yes, a daily number of messages, pictures and voice per person, so the free services behind Jarvis keep working for everyone. You can see your messages left in Settings."],
  ["Can other people see my chats?", "No. Every conversation, memory and file belongs to your account, and the server checks that on every request."],
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default function FAQPage() {
  return (
    <main id="main" tabIndex={-1} className="relative z-[1] min-h-screen px-5 pb-20 pt-28 sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs current="FAQ" />
        <h1 className="font-display mt-6 text-6xl leading-none">Questions<em className="text-[var(--accent)]">?</em></h1>
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">The useful stuff, without the corporate fog machine.</p>
        <div className="mt-10 border-t border-[var(--hairline)]">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group border-b border-[var(--hairline)]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-medium">
                {question}
                <span aria-hidden className="text-[var(--accent)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-5 leading-7 text-[var(--muted)]">{answer}</p>
            </details>
          ))}
        </div>
        <Link href="/login" className="btn-ink mt-10">Start a conversation <span className="btn-arrow" aria-hidden>→</span></Link>
      </div>
    </main>
  );
}
