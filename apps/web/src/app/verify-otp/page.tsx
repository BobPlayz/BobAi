"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPendingVerificationEmail, requestOtp, verifyOtp } from "@/lib/auth";
import BobLogo from "@/components/BobLogo";

const emailPattern = /^\S+@\S+\.\S+$/;

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const queryEmail = new URLSearchParams(window.location.search).get("email")?.trim().toLowerCase() || "";
    setEmail(queryEmail || getPendingVerificationEmail());
  }, []);

  async function handleSendCode() {
    setError("");
    setMessage("");
    const cleanEmail = email.trim().toLowerCase();
    if (!emailPattern.test(cleanEmail)) {
      setError("enter a valid email address first");
      return;
    }

    setLoading(true);
    const result = await requestOtp(cleanEmail);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "verification email could not be sent right now");
      return;
    }
    setMessage(`verification code sent to ${cleanEmail}`);
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    if (!emailPattern.test(cleanEmail)) {
      setError("enter a valid email address");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    const result = await verifyOtp(cleanEmail, code);
    setLoading(false);

    if (!result.ok) {
      setError(result.error || "invalid or expired verification code");
      return;
    }

    setMessage("email verified");
    router.push("/onboarding");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 text-white">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3">
          <BobLogo />
          <div>
            <h1 className="text-xl font-semibold">bobai</h1>
            <p className="text-sm text-white/45">alpha</p>
          </div>
        </div>

        <h2 className="text-4xl font-black tracking-tight">verify email</h2>
        <p className="mt-2 text-white/60">optional email verification for your BobAI account</p>

        <form onSubmit={handleVerify} className="mt-8 space-y-4">
          <input value={email} onChange={(event) => setEmail(event.target.value.toLowerCase())} type="email" placeholder="email" autoComplete="email" required className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35" />

          <button type="button" onClick={() => void handleSendCode()} disabled={loading} className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "sending..." : "send verification code"}
          </button>

          <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none transition focus:border-white/25 placeholder:text-white/35" />

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-white/60">{message}</p>}

          <button type="submit" disabled={loading || code.length !== 6} className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "checking..." : "verify email"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <Link href="/login" className="hover:text-white">back to login</Link>
          <Link href="/signup" className="hover:text-white">create account</Link>
        </div>
      </div>
    </main>
  );
}
