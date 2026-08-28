"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";
import { getPendingVerificationEmail, requestOtp, verifyOtp } from "@/lib/auth";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEmail(getPendingVerificationEmail());
  }, []);

  async function handleVerify() {
    setError("");
    setMessage("");
    if (!email || !/^\d{6}$/.test(code)) {
      setError("enter the 6-digit verification code");
      return;
    }
    setLoading(true);
    const ok = await verifyOtp(email, code);
    setLoading(false);
    if (!ok) {
      setError("invalid or expired verification code");
      return;
    }
    router.push(`/login?email=${encodeURIComponent(email)}`);
  }

  async function handleResend() {
    setError("");
    setMessage("");
    if (!email) {
      setError("enter your email first");
      return;
    }
    setLoading(true);
    const ok = await requestOtp(email);
    setLoading(false);
    setMessage(ok ? "a new verification code was sent" : "verification is unavailable");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 text-white">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3"><BobLogo /><div><h1 className="text-xl font-semibold">bobai</h1><p className="text-sm text-white/45">alpha</p></div></div>
        <h2 className="text-4xl font-black tracking-tight">verify email</h2>
        <p className="mt-2 text-white/60">enter the 6-digit code sent to your email</p>
        <div className="mt-8 space-y-4">
          <input value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} type="email" placeholder="email" autoComplete="email" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none placeholder:text-white/35" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-white/60">{message}</p>}
          <button onClick={() => void handleVerify()} disabled={loading} className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "checking..." : "verify"}</button>
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <Link href="/login" className="hover:text-white">back to login</Link>
          <button onClick={() => void handleResend()} disabled={loading} className="hover:text-white disabled:opacity-50">resend code</button>
        </div>
      </div>
    </main>
  );
}
