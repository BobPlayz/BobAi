export const metadata = {
  title: "Terms of Service | Bob AI",
  description: "The terms that apply when you use Bob AI.",
};

const sections = [
  ["1. Using Bob AI", "Bob AI provides AI chat, research, creation, development, memory, file, agent, and automation features. Features and limits may change as the service evolves. You are responsible for using the service lawfully and for checking important AI-generated results before relying on them."],
  ["2. Accounts", "Keep your account credentials secure and use only accounts, workspaces, files, conversations, tasks, and integrations you are authorized to access. Do not bypass access controls or attempt to access another person's data."],
  ["3. Agents and automated actions", "Agents and automations may interact with tools or external services. Use least-privilege permissions and review sensitive actions before they run. You remain responsible for permissions and instructions you give to an agent."],
  ["4. Your content", "You retain rights in content you submit, subject to the limited processing needed to provide the requested feature. You must have the rights and authorization needed to submit content."],
  ["5. AI output", "AI-generated text, code, images, audio, video, and research can be inaccurate, incomplete, or unsuitable. Review outputs before using them for important decisions or publishing them."],
  ["6. Prohibited use", "Do not use Bob AI to obtain unauthorized access to systems or data, distribute malware, evade security controls, abuse other users, violate privacy or intellectual-property rights, or break applicable law."],
  ["7. Third-party services", "Some features may depend on external AI, search, storage, media, email, or other providers. Those providers can have separate terms, privacy notices, availability limits, and content rules."],
  ["8. Availability and termination", "Bob AI may be changed, suspended, or made unavailable for maintenance, security, abuse prevention, legal compliance, or other operational reasons. Accounts may be restricted when required to protect users or the service."],
  ["9. Disclaimers and liability", "To the maximum extent permitted by applicable law, Bob AI is provided on an as-available basis and does not promise uninterrupted or error-free operation. Nothing in these terms excludes liability that cannot legally be excluded."],
  ["10. Privacy", "Our Privacy Policy explains the personal data Bob AI may process, why it is processed, retention and security practices, and how to exercise applicable rights."],
  ["11. Changes", "When material changes are made, Bob AI will provide notice as required by applicable law. The latest version and effective date will be published on this page."],
];

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-white sm:px-8">
      <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 shadow-2xl backdrop-blur-xl sm:p-10">
        <p className="text-sm text-white/45">Last updated: September 8, 2026</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-4 max-w-2xl leading-7 text-white/65">These terms describe the basic rules for using Bob AI. They are a product/legal draft and must be reviewed and completed with the operator&apos;s legal identity, contact details, governing law, and any applicable commercial terms before public launch.</p>
        <div className="mt-10 space-y-8">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 leading-7 text-white/65">{body}</p>
              {title === "10. Privacy" && <a href="/privacy" className="mt-3 inline-block text-cyan-300 hover:text-cyan-200">Read the Privacy Policy →</a>}
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-sm leading-6 text-white/45">Nothing on this page is legal advice. The operator should obtain jurisdiction-specific legal review before accepting users in production.</p>
      </article>
    </main>
  );
}
