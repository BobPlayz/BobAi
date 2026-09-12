"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, requestLoginOtp, verifyLoginOtp, verifyMfaLogin } from "@/lib/auth";
import BobLogo from "@/components/BobLogo";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Mode = "password" | "otp";

function ProviderIcon({ provider }: { provider: "google" | "apple" | "github" }) {
  if (provider === "google") return <span className="text-lg font-black">G</span>;
  if (provider === "apple") return <span className="text-lg"></span>;
  return <span className="text-lg font-black">GH</span>;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("email");
    if (value) setEmail(value);
    const mfa = params.get("mfa");
    if (mfa) { setChallengeToken(mfa); setMessage("MFA is enabled. enter the current code from your authenticator app."); }
    const oauthError = params.get("oauth_error");
    if (oauthError) setError(oauthError);
    if (params.get("created") === "1") setMessage("account created. verify your email, then sign in.");
  }, []);

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); const cleanEmail = email.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError("enter a valid email address"); if (!password) return setError("enter your password"); setLoading(true); const result = await login(cleanEmail, password); setLoading(false); if (!result.ok) return setError(result.error || "invalid email or password"); if (result.mfaRequired) { setChallengeToken(result.challengeToken); setMessage("MFA is enabled. enter the current code from your authenticator app."); return; } router.push("/onboarding");
  }

  async function handleOtpRequest() {
    setError(""); setMessage(""); const cleanEmail = email.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError("enter a valid email address"); setLoading(true); const result = await requestLoginOtp(cleanEmail); setLoading(false); if (!result.ok) return setError(result.error || "sign-in code could not be sent"); setMessage("if the account exists, a 6-digit sign-in code has been sent to your email.");
  }

  async function handleOtpLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); const cleanEmail = email.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError("enter a valid email address"); if (!/^\d{6}$/.test(otp)) return setError("enter the 6-digit sign-in code"); setLoading(true); const result = await verifyLoginOtp(cleanEmail, otp); setLoading(false); if (!result.ok) return setError(result.error || "invalid or expired sign-in code"); if (result.mfaRequired) { setChallengeToken(result.challengeToken); setMessage("MFA is enabled. enter the current code from your authenticator app."); return; } router.push("/onboarding");
  }

  async function handleMfa(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); if (!/^\d{6}$/.test(mfaCode)) return setError("enter the 6-digit MFA code"); setLoading(true); const result = await verifyMfaLogin(challengeToken, mfaCode); setLoading(false); if (!result.ok) return setError(result.error || "MFA verification failed"); router.push("/onboarding"); }

  return (
    <main className="min-h-screen bg-[#080a0d] px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <Link href="/" className="mb-10 flex items-center gap-3 self-start"><BobLogo /><div><p className="text-lg font-semibold">Bob AI</p><p className="text-xs text-white/40">your AI workspace</p></div></Link>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <h1 className="text-3xl font-black tracking-tight">welcome back</h1>
          <p className="mt-2 text-sm text-white/50">Sign in to your BobAI account.</p>

          {!challengeToken && <div className="mt-7 space-y-3">
            <a href={`${API}/auth/oauth/google/start`} className="flex h-12 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white text-sm font-semibold text-black transition hover:bg-white/90"><ProviderIcon provider="google" /> Continue with Google</a>
            <a href={`${API}/auth/oauth/apple/start`} className="flex h-12 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white text-sm font-semibold text-black transition hover:bg-white/90"><ProviderIcon provider="apple" /> Continue with Apple</a>
            <a href={`${API}/auth/oauth/github/start`} className="flex h-12 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#17191d] text-sm font-semibold text-white transition hover:bg-[#202329]"><ProviderIcon provider="github" /> Continue with GitHub</a>
          </div>}

          {!challengeToken && <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/25"><span className="h-px flex-1 bg-white/10" /><span>or</span><span className="h-px flex-1 bg-white/10" /></div>}

          {challengeToken ? <form onSubmit={handleMfa} className="space-y-4"><p className="text-sm text-white/55">Verify the second factor to finish signing in.</p><input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit MFA code" maxLength={6} autoFocus className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-xl tracking-[0.4em] outline-none focus:border-cyan-300/50" /><button disabled={loading} className="w-full rounded-2xl bg-cyan-300 py-3 font-bold text-black disabled:opacity-50">{loading ? "verifying..." : "verify MFA"}</button></form> : mode === "password" ? <form onSubmit={handlePasswordLogin} className="space-y-4"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" type="email" autoComplete="email" required className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 outline-none focus:border-cyan-300/40" /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="password" required className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 outline-none focus:border-cyan-300/40" /><button disabled={loading} className="w-full rounded-2xl bg-white py-3 font-bold text-black disabled:opacity-50">{loading ? "checking..." : "sign in"}</button><button type="button" onClick={() => { setMode("otp"); setError(""); setMessage(""); }} className="w-full text-sm text-cyan-300 hover:text-cyan-200">forgot your password? sign in with an email code</button></form> : <form onSubmit={handleOtpLogin} className="space-y-4"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" type="email" autoComplete="email" required className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 outline-none focus:border-cyan-300/40" /><button type="button" onClick={() => void handleOtpRequest()} disabled={loading} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 font-semibold disabled:opacity-50">{loading ? "sending..." : "send email code"}</button><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-xl tracking-[0.4em] outline-none focus:border-cyan-300/40" /><button disabled={loading || otp.length !== 6} className="w-full rounded-2xl bg-white py-3 font-bold text-black disabled:opacity-50">{loading ? "signing in..." : "sign in with code"}</button><button type="button" onClick={() => { setMode("password"); setError(""); setMessage(""); }} className="w-full text-sm text-white/45 hover:text-white">back to password sign in</button></form>}

          {message && <p className="mt-4 text-sm text-white/55">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          {!challengeToken && <div className="mt-7 flex items-center justify-between text-sm text-white/45"><Link href="/signup" className="hover:text-white">create account</Link><Link href="/verify-otp" className="hover:text-white">verify email</Link></div>}
        </div>
      </div>
    </main>
  );
}
