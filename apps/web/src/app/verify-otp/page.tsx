"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPendingVerificationEmail, requestOtp, verifyOtp } from "@/lib/auth";
import BobLogo from "@/components/BobLogo";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get("email")?.trim().toLowerCase() || "";
    const sent = params.get("sent");
    const pendingEmail = getPendingVerificationEmail();
    const initialEmail = queryEmail || pendingEmail;

    setEmail(initialEmail);

    if (sent === "1" && initialEmail) {
      setMessage(`verification code sent to ${initialEmail}`);
    } else if (sent === "0") {
      setMessage("account created, but the verification email could not be sent. check your email or resend the code");
    }
  }, []);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("enter a valid email address");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    const ok = await verifyOtp(cleanEmail, code);
    setLoading(false);

    if (!ok) {
      setError("invalid or expired verification code");
      return;
    }

    router.push(`/login?email=${encodeURIComponent(cleanEmail)}`);
  }

  async function handleResend() {
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("enter a valid email address first");
      return;
    }

    setLoading(true);
    const ok = await requestOtp(cleanEmail);
    setLoading(false);

    setMessage(ok ? `verification code sent to ${cleanEmail}` : "verification email could not be sent right now");
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
        <p className="mt-2 text-white/60">enter the 6-digit code from your email</p>

        <form onSubmit={handleVerify} className="mt-8 space-y-4">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value.toLowerCase())}
            type="email"
            placeholder="email"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35"
          />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={6}
            required
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none transition focus:border-white/25 placeholder:text-white/35"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-white/60">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "checking..." : "verify"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <Link href="/login" className="hover:text-white">back to login</Link>
          <button type="button" onClick={() => void handleResend()} disabled={loading} className="hover:text-white disabled:opacity-50">
            resend code
          </button>
        </div>
      </div>
    </main>
  );
}
