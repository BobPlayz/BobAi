"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";
import { login, verifyMfaLogin } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("email");
    if (value) setEmail(value);
    if (params.get("created") === "1") setMessage("account created — you can log in now");
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (challengeToken) {
      if (!/^\d{6}$/.test(mfaCode)) {
        setError("enter the 6-digit code from your authenticator app");
        return;
      }
      setLoading(true);
      const result = await verifyMfaLogin(challengeToken, mfaCode);
      setLoading(false);
      if (!result.ok) {
        setError(result.error || "MFA verification failed");
        return;
      }
      router.push("/onboarding");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("enter a valid email address");
      return;
    }
    if (!password) {
      setError("enter your password");
      return;
    }

    setLoading(true);
    const result = await login(cleanEmail, password);
    setLoading(false);

    if (!result.ok) {
      setError("invalid email or password");
      return;
    }
    if (result.mfaRequired) {
      setChallengeToken(result.challengeToken);
      setMessage("MFA is enabled. enter the current code from your authenticator app.");
      return;
    }

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

        <h2 className="text-4xl font-black tracking-tight">welcome back</h2>
        <p className="mt-2 text-white/60">{challengeToken ? "verify your identity" : "log in to your BobAI account"}</p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          {!challengeToken ? (
            <>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" type="email" autoComplete="email" required className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="password" required className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35" />
            </>
          ) : (
            <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit MFA code" maxLength={6} required autoFocus className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xl tracking-[0.4em] outline-none transition focus:border-white/25 placeholder:text-white/35" />
          )}
          {message && <p className="text-sm text-white/60">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "checking..." : challengeToken ? "verify MFA" : "log in"}
          </button>
          {challengeToken && <button type="button" onClick={() => { setChallengeToken(""); setMfaCode(""); setMessage(""); setError(""); }} className="w-full rounded-2xl border border-white/10 py-3 text-sm text-white/60 transition hover:border-white/25 hover:text-white">back to login</button>}
        </form>

        {!challengeToken && <div className="mt-6 flex items-center justify-between text-sm text-white/50"><Link href="/signup" className="hover:text-white">create account</Link><Link href={`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`} className="hover:text-white">verify email</Link></div>}
      </div>
    </main>
  );
}
