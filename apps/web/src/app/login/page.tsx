"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API, getPendingVerificationEmail, getPendingVerificationName, requestQuickStart, startGuest, verifyQuickStart, verifyMfaLogin, refreshSession } from "@/lib/auth";
import JarvisMark from "@/components/JarvisMark";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const FALLBACK_TERMS_VERSION = "2026-10-23";
// The API decides which Terms version is current; the built-in date is only a fallback if that lookup fails.
const currentTermsVersion = () => fetch(`${API}/auth/terms-version`).then((response) => response.ok ? response.json() as Promise<{ version?: unknown }> : {}).then((data) => typeof (data as { version?: unknown }).version === "string" ? (data as { version: string }).version : FALLBACK_TERMS_VERSION).catch(() => FALLBACK_TERMS_VERSION);

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<"details" | "verify" | "mfa">("details");
  const [challengeToken, setChallengeToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((session) => {
      if (!cancelled && session) router.replace("/chat");
    });
    const pending = getPendingVerificationEmail();
    const pendingName = getPendingVerificationName();
    if (pending) {
      setEmail(pending);
      setName(pendingName);
      setStep("verify");
      setNotice("Enter the 6-digit code sent to your email.");
    }
    return () => { cancelled = true; };
  }, [router]);

  async function tryAsGuest() {
    setError("");
    setNotice("");
    setLoading(true);
    const result = await startGuest(name, await currentTermsVersion());
    setLoading(false);
    if (!result.ok) return setError(result.error || "Guest sign-in isn't working right now.");
    router.push("/onboarding");
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const cleanName = name.trim().replace(/\s+/g, " ");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || cleanName.length > 80) return setError("Enter a name of up to 80 characters.");
    if (!EMAIL_PATTERN.test(cleanEmail)) return setError("Enter a valid email address.");
    if (!termsAccepted) return setError("Please accept the Terms and Privacy Policy to continue.");
    setLoading(true);
    const termsVersion = await currentTermsVersion();
    const result = await requestQuickStart(cleanName, cleanEmail, true, termsVersion);
    setLoading(false);
    if (!result.ok) return setError(result.error || "Could not send your code.");
    setName(cleanName);
    setEmail(cleanEmail);
    setStep("verify");
    setNotice("If this email can be used, a 6-digit verification code has been sent. The code expires in 10 minutes.");
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(cleanEmail) || !/^\d{6}$/.test(code.trim())) return setError("Enter the email address and its 6-digit code.");
    setLoading(true);
    const result = await verifyQuickStart(name.trim().replace(/\s+/g, " "), cleanEmail, code.trim());
    setLoading(false);
    if (!result.ok) return setError(result.error || "Verification failed.");
    if (result.mfaRequired && result.challengeToken) {
      setChallengeToken(result.challengeToken);
      setCode("");
      setStep("mfa");
      setNotice("This account needs its authenticator code to finish signing in.");
      return;
    }
    router.replace("/chat");
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!challengeToken || !/^\d{6}$/.test(mfaCode)) return setError("Enter the 6-digit authenticator code.");
    setLoading(true);
    const result = await verifyMfaLogin(challengeToken, mfaCode);
    setLoading(false);
    if (!result.ok) return setError(result.error || "Authenticator verification failed.");
    router.replace("/chat");
  }

  const heading = step === "details" ? "Say hello." : step === "verify" ? "Check your inbox." : "One more code.";
  return (
    <main id="main" tabIndex={-1} className="relative z-[1] grid min-h-screen bg-[var(--bg)] text-[var(--text)] lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-[var(--hairline)] p-10 lg:flex">
        <Link href="/" className="atelier-wordmark" aria-label="Jarvis home"><JarvisMark />Jarvis</Link>
        <div>
          <p className="caption">Sign in</p>
          <p className="font-display mt-4 text-6xl leading-[0.95]">An assistant,<br /><em className="text-[var(--accent)]">not an oracle.</em></p>
          <p className="mt-6 max-w-sm text-[var(--muted)]">No password to remember. We email you a 6-digit code each time you sign in.</p>
        </div>
        <Link href="/demo" className="caption hover:text-[var(--text)]">Just looking? Try the demo →</Link>
      </aside>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="atelier-wordmark lg:hidden" aria-label="Jarvis home"><JarvisMark />Jarvis</Link>
          <p className="caption mt-10 lg:mt-0">{step === "details" ? "Step 1 of 2 — your details" : step === "verify" ? "Step 2 of 2 — email code" : "Two-step verification"}</p>
          <h1 className="font-display mt-3 text-5xl leading-none">{heading}</h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            {step === "details" ? "Tell Jarvis your name and email. We’ll send you a code — no password needed." : step === "verify" ? `Enter the 6-digit code we sent to ${email || "your email"}. You’ll stay signed in on this device.` : "Enter the 6-digit code from your authenticator app to finish signing in."}
          </p>

          {step === "details" ? (
            <form onSubmit={submitDetails} className="mt-8 space-y-5">
              <label className="block text-sm font-medium">Your name
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} required placeholder="What should Jarvis call you?" className="mt-2 h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--text)] outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--text)]" />
              </label>
              <label className="block text-sm font-medium">Email address
                <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" required placeholder="you@example.com" className="mt-2 h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--text)] outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--text)]" />
              </label>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm leading-6 text-[var(--muted)]">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} aria-labelledby="terms-label" className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
                <span id="terms-label">I agree to the <Link href="/terms" target="_blank" className="md-link">Terms</Link> and <Link href="/privacy" target="_blank" className="md-link">Privacy Policy</Link>.</span>
              </label>
              <button type="submit" disabled={loading} className="btn-ink w-full justify-center disabled:opacity-50">
                {loading ? "One sec…" : <>Send my code <span className="btn-arrow" aria-hidden>→</span></>}
              </button>
              <div className="flex items-center gap-3 pt-2 text-xs uppercase tracking-widest text-[var(--muted)]" aria-hidden><span className="h-px flex-1 bg-[var(--hairline)]" />or<span className="h-px flex-1 bg-[var(--hairline)]" /></div>
              <button type="button" onClick={() => void tryAsGuest()} disabled={loading} className="btn-line w-full justify-center disabled:opacity-50">Just try it, no email needed</button>
              <p className="text-center text-xs leading-5 text-[var(--muted)]">By trying it you agree to the <Link href="/terms" target="_blank" className="md-link">Terms</Link> and <Link href="/privacy" target="_blank" className="md-link">Privacy Policy</Link>. Guest chats live on this device only, so logging out ends them.</p>
            </form>
          ) : step === "verify" ? (
            <form onSubmit={submitCode} className="mt-8 space-y-5">
              <label className="block text-sm font-medium">6-digit email code
                <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" className="mt-2 h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-center font-mono text-2xl tracking-[0.4em] text-[var(--text)] outline-none transition focus:border-[var(--text)]" />
              </label>
              <button type="submit" disabled={loading || code.length !== 6} className="btn-ink w-full justify-center disabled:opacity-50">
                {loading ? "Checking…" : <>Verify and continue <span className="btn-arrow" aria-hidden>→</span></>}
              </button>
              <button type="button" onClick={() => { setStep("details"); setCode(""); setError(""); setNotice(""); }} className="w-full py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">Use a different email</button>
            </form>
          ) : (
            <form onSubmit={submitMfa} className="mt-8 space-y-5">
              <label className="block text-sm font-medium">6-digit authenticator code
                <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" className="mt-2 h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-center font-mono text-2xl tracking-[0.4em] text-[var(--text)] outline-none transition focus:border-[var(--text)]" />
              </label>
              <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn-ink w-full justify-center disabled:opacity-50">{loading ? "Checking…" : "Verify authenticator"}</button>
              <button type="button" onClick={() => { setStep("details"); setChallengeToken(""); setMfaCode(""); setCode(""); setError(""); setNotice(""); }} className="w-full py-2 text-sm text-[var(--muted)] hover:text-[var(--text)]">Start over</button>
            </form>
          )}

          {error && <p role="alert" className="mt-5 rounded-2xl border border-[var(--danger)] p-4 text-sm text-[var(--danger)]">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">{notice}</p>}
        </div>
      </section>
    </main>
  );
}
