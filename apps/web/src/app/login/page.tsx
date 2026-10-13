"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";
import { getPendingVerificationEmail, requestQuickStart, verifyQuickStart } from "@/lib/auth";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const TERMS_VERSION = process.env.NEXT_PUBLIC_TERMS_VERSION || "2026-10-13";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<"details" | "verify">("details");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const pending = getPendingVerificationEmail();
    if (pending) {
      setEmail(pending);
      setStep("verify");
      setNotice("Enter the 6-digit code sent to your email.");
    }
  }, []);

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
    const result = await requestQuickStart(cleanName, cleanEmail, true, TERMS_VERSION);
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
    const result = await verifyQuickStart(cleanEmail, code.trim());
    setLoading(false);
    if (!result.ok) return setError(result.error || "Verification failed.");
    router.replace("/chat");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080a0d] px-4 py-8 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <BobLogo />
          <span className="text-lg font-semibold">BobAI</span>
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Email verification</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{step === "details" ? "Get started" : "Check your inbox"}</h1>
        <p className="mt-2 text-sm leading-6 text-white/55">
          {step === "details"
            ? "Enter your name and email. No password or social sign-in is needed."
            : `Enter the 6-digit code sent to ${email || "your email"}. You will stay signed in on this device until your session expires or you sign out.`}
        </p>

        {step === "details" ? (
          <form onSubmit={submitDetails} className="mt-6 space-y-4">
            <label className="block text-sm text-white/75">Your name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} required placeholder="Name you want BobAI to use" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none transition focus:border-cyan-300/60" />
            </label>
            <label className="block text-sm text-white/75">Email address
              <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" required placeholder="you@example.com" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm outline-none transition focus:border-cyan-300/60" />
            </label>
            <label className="flex items-start gap-3 text-xs leading-5 text-white/55">
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1" />
              <span>I agree to the <Link href="/terms" target="_blank" className="text-cyan-300 underline">Terms</Link> and <Link href="/privacy" target="_blank" className="text-cyan-300 underline">Privacy Policy</Link>.</span>
            </label>
            <button disabled={loading} className="h-12 w-full rounded-xl bg-cyan-300 font-semibold text-black transition hover:bg-cyan-200 disabled:opacity-50">
              {loading ? "Sending code…" : "Send email code"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-6 space-y-4">
            <label className="block text-sm text-white/75">6-digit email code
              <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-center font-mono text-xl tracking-[0.35em] outline-none transition focus:border-cyan-300/60" />
            </label>
            <button disabled={loading || code.length !== 6} className="h-12 w-full rounded-xl bg-cyan-300 font-semibold text-black transition hover:bg-cyan-200 disabled:opacity-50">
              {loading ? "Verifying…" : "Verify and continue"}
            </button>
            <button type="button" onClick={() => { setStep("details"); setCode(""); setError(""); setNotice(""); }} className="w-full py-2 text-sm text-white/55 hover:text-white">Use a different email</button>
          </form>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3 text-sm text-cyan-100/80">{notice}</p>}
        <p className="mt-6 text-xs leading-5 text-white/35">Never share your verification code. Email delivery must be configured by the server administrator. A hosted AI provider may process prompts when enabled.</p>
      </section>
    </main>
  );
}
