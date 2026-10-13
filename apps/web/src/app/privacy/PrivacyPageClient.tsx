"use client";

import { useTheme } from "@/components/neural/ThemeProvider";

export default function PrivacyPageClient() {
  const { theme } = useTheme();
  const light = theme === "light";
  const colors = light
    ? { page: "bg-[#f7f8fa] text-[#202123]", panel: "border-[#e5e7eb] bg-white shadow-sm", muted: "text-[#5f6672]", divider: "border-[#e5e7eb]" }
    : { page: "bg-[#08090b] text-white", panel: "border-white/10 bg-white/[0.03] shadow-2xl", muted: "text-white/65", divider: "border-white/10" };
  return (
    <main className={`mx-auto min-h-screen max-w-4xl px-6 py-16 sm:px-8 ${colors.page}`}>
      <article className={`rounded-3xl border p-7 backdrop-blur-xl sm:p-10 ${colors.panel}`}>
        <p className={`text-sm ${colors.muted}`}>Last updated: October 13, 2026</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Privacy Policy</h1>
        <p className={`mt-4 leading-7 ${colors.muted}`}>Bob AI is an AI workspace for chat, research, creation, and development. This policy explains what information the service may process and how users can control it.</p>
        <div className="mt-10 space-y-8">
          <section><h2 className="text-xl font-semibold">1. Information we process</h2><p className={`mt-2 leading-7 ${colors.muted}`}>Depending on the features you use, Bob AI may process your email address and username, authentication and security information, conversations and memories you choose to store, files or media you submit, generated results, preferences, and technical information needed to operate and secure the service.</p></section>
          <section><h2 className="text-xl font-semibold">2. Why we process it</h2><p className={`mt-2 leading-7 ${colors.muted}`}>We process information to provide requested AI features, authenticate accounts, save conversations and preferences, maintain security, prevent abuse, troubleshoot failures, and comply with applicable law. Each production data flow must have a documented purpose and an appropriate lawful basis.</p></section>
          <section><h2 className="text-xl font-semibold">3. Cookies and local storage</h2><p className={`mt-2 leading-7 ${colors.muted}`}>Strictly necessary authentication cookies are used to keep a signed-in session working securely. Optional analytics are separate and are not loaded unless you explicitly allow them through the analytics banner. The analytics choice is stored locally on your device. Bob AI does not require advertising cookies to provide the core service.</p></section>
          <section><h2 className="text-xl font-semibold">4. AI providers and integrations</h2><p className={`mt-2 leading-7 ${colors.muted}`}>Some features may send the input needed to perform your request to a configured AI, search, media, email, or hosting provider. Bob AI aims to send only information necessary for the requested operation. The production provider inventory and applicable processor terms must be maintained and published before launch.</p></section>
          <section><h2 className="text-xl font-semibold">5. Your content</h2><p className={`mt-2 leading-7 ${colors.muted}`}>Do not submit passwords, payment credentials, government identification numbers, highly sensitive personal information, or another person&apos;s private information unless a feature specifically requires it and you are authorized to provide it. AI outputs can be inaccurate and should be reviewed before important decisions.</p></section>
          <section><h2 className="text-xl font-semibold">6. Children</h2><p className={`mt-2 leading-7 ${colors.muted}`}>Where applicable law requires verifiable parental or lawful-guardian consent for processing a child&apos;s personal data, Bob AI must use the required consent mechanism before processing that data. Child-specific safeguards must be enforced by the product and backend, not only described in this notice.</p></section>
          <section><h2 className="text-xl font-semibold">7. Security and retention</h2><p className={`mt-2 leading-7 ${colors.muted}`}>We use reasonable technical and organizational safeguards, including authentication, authorization, rate limiting, access controls, and audit-oriented logging. Information should be retained only for as long as reasonably necessary for the stated purpose, legal obligations, security, dispute resolution, or service operation. Account deletion requests disable the account immediately and schedule permanent deletion after a 30-day grace period; accounts that still own shared workspaces are held for resolution rather than silently deleting shared data. Category-specific retention periods and legal exceptions must be reviewed before production launch.</p></section>
          <section><h2 className="text-xl font-semibold">8. Your rights and controls</h2><p className={`mt-2 leading-7 ${colors.muted}`}>Subject to applicable law, you may have rights to access information about processing, request correction or deletion, withdraw consent where consent is the basis, and raise a grievance. Authenticated account controls include data export and account deletion. Requests must be scoped to the authenticated user and authorized workspace.</p></section>
          <section><h2 className="text-xl font-semibold">9. Contact and grievances</h2><p className={`mt-2 leading-7 ${colors.muted}`}>The final public notice must publish the operator/data fiduciary identity, official privacy contact, and grievance channel required by applicable law. These details are intentionally not invented here.</p></section>
          <section><h2 className="text-xl font-semibold">10. Changes and legal framework</h2><p className={`mt-2 leading-7 ${colors.muted}`}>We may update this policy when the service, providers, or applicable law changes. This notice is intended to be operated consistently with applicable Indian law, including the Digital Personal Data Protection Act, 2023 and applicable rules, and relevant information-technology laws and rules. If a legal requirement changes, applicable law prevails.</p></section>
        </div>
        <p className={`mt-10 border-t pt-6 text-sm leading-6 ${colors.muted} ${colors.divider}`}>This is a product/legal draft, not legal advice. Operator identity, provider inventory, retention schedule, grievance contact, and child-data consent design must be completed and legally reviewed before public production launch.</p>
      </article>
    </main>
  );
}
