export const metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use Jarvis.",
};

const sections = [
  ["1. Using Jarvis", "Jarvis provides AI chat, research, creation, development, memory, file, agent, and automation features. Features and limits may change as the service evolves. You are responsible for using the service lawfully and for checking important AI-generated results before relying on them."],
  ["2. Accounts", "Keep your account credentials secure and use only accounts, workspaces, files, conversations, tasks, and integrations you are authorized to access. Do not bypass access controls or attempt to access another person's data."],
  ["3. Agents and automated actions", "Agents and automations may interact with tools or external services. Use least-privilege permissions and review sensitive actions before they run. You remain responsible for permissions and instructions you give to an agent."],
  ["4. Your content", "You retain rights in content you submit, subject to the limited processing needed to provide the requested feature. You must have the rights and authorization needed to submit content."],
  ["5. AI output", "AI-generated text, code, images, audio, video, and research can be inaccurate, incomplete, or unsuitable. Review outputs before using them for important decisions or publishing them."],
  ["6. Prohibited use", "Do not use Jarvis to obtain unauthorized access to systems or data, distribute malware, evade security controls, abuse other users, violate privacy or intellectual-property rights, or break applicable law."],
  ["7. Third-party services", "Some features may depend on external AI, search, storage, media, email, or other providers. Those providers can have separate terms, privacy notices, availability limits, and content rules."],
  ["8. Availability and termination", "Jarvis may be changed, suspended, or made unavailable for maintenance, security, abuse prevention, legal compliance, or other operational reasons. Accounts may be restricted when required to protect users or the service."],
  ["9. Disclaimers and liability", "To the maximum extent permitted by applicable law, Jarvis is provided on an as-available basis and does not promise uninterrupted or error-free operation. Nothing in these terms excludes liability that cannot legally be excluded."],
  ["10. Privacy", "Our Privacy Policy explains the personal data Jarvis may process, why it is processed, retention and security practices, and how to exercise applicable rights."],
  ["11. Changes", "When material changes are made, Jarvis will provide notice as required by applicable law. The latest version and effective date will be published on this page."],
];

export default function TermsPage() {
  return (
    <main id="main" tabIndex={-1} className="relative z-[1] mx-auto min-h-screen max-w-3xl px-5 pb-20 pt-28 text-[var(--text)] sm:px-8">
      <article className="">
        <p className="text-sm text-[var(--muted)]">Last updated: September 8, 2026</p>
        <h1 className="font-display mt-3 text-6xl leading-none">Terms<em className="text-[var(--accent)]">.</em></h1>
        <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">These terms describe the basic rules for using Jarvis. They are a product/legal draft and must be reviewed and completed with the operator&apos;s legal identity, contact details, governing law, and any applicable commercial terms before public launch.</p>
        <div className="mt-10 space-y-8">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 leading-7 text-[var(--muted)]">{body}</p>
              {title === "10. Privacy" && <a href="/privacy" className="mt-3 inline-block text-[var(--accent)] underline underline-offset-4">Read the Privacy Policy →</a>}
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-[var(--hairline)] pt-6 text-sm leading-6 text-[var(--muted)]">Nothing on this page is legal advice. The operator should obtain jurisdiction-specific legal review before accepting users in production.</p>
      </article>
    </main>
  );
}
