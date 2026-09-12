"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPendingVerificationEmail, login, register, requestLoginOtp, requestOtp, verifyLoginOtp, verifyMfaLogin, verifyOtp } from "@/lib/auth";
import BobLogo from "@/components/BobLogo";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const emailPattern = /^\S+@\S+\.\S+$/;
const usernamePattern = /^[A-Za-z0-9_]{3,32}$/;
type Mode = "signin" | "signup" | "otp" | "verify" | "mfa";

function GoogleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path fill="currentColor" d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.95h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.25Z"/><path fill="currentColor" d="M12 21.72c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.72Z"/><path fill="currentColor" d="M6.53 13.81a5.86 5.86 0 0 1 0-3.62V7.66H3.29a9.73 9.73 0 0 0 0 8.68l3.24-2.53Z"/><path fill="currentColor" d="M12 6.16c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.83 3.23 14.62 2.28 12 2.28a9.74 9.74 0 0 0-8.71 5.38l3.24 2.53C7.3 7.88 9.46 6.16 12 6.16Z"/></svg>; }
function AppleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current"><path d="M16.77 12.53c.02 2.4 2.1 3.2 2.12 3.21-.02.06-.33 1.13-1.1 2.23-.66.96-1.35 1.91-2.44 1.93-1.07.02-1.42-.62-2.65-.62-1.23 0-1.62.6-2.64.64-1.06.04-1.86-1.03-2.52-1.99-1.37-1.97-2.42-5.57-1.01-8.01.7-1.22 1.94-1.99 3.28-2.01 1.04-.02 2.02.69 2.65.69.63 0 1.81-.85 3.05-.73.52.02 1.98.21 2.92 1.57-.08.05-1.74 1.02-1.66 3.09ZM14.75 6.78c.56-.68.94-1.63.84-2.58-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.57-.86 2.49.9.07 1.82-.46 2.39-1.13Z"/></svg>; }
function GithubIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current"><path d="M12 .7a11.3 11.3 0 0 0-3.57 22.02c.57.1.78-.25.78-.55v-2.17c-3.18.69-3.85-1.35-3.85-1.35-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.54-.29-5.2-1.27-5.2-5.65 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.12 1.17a10.8 10.8 0 0 1 5.68 0c2.16-1.48 3.12-1.17 3.12-1.17.62 1.57.23 2.73.11 3.02.73.8 1.18 1.82 1.18 3.07 0 4.39-2.67 5.35-5.22 5.64.41.35.77 1.04.77 2.1v3.1c0 .3.21.66.79.55A11.3 11.3 0 0 0 12 .7Z"/></svg>; }

function SocialButtons() {
  const providers = [
    ["google", "Google", GoogleIcon],
    ["apple", "Apple", AppleIcon],
    ["github", "GitHub", GithubIcon],
  ] as const;
  return <div className="grid grid-cols-3 gap-2.5">{providers.map(([provider, label, Icon]) => <a key={provider} href={`${API}/auth/oauth/${provider}/start`} aria-label={`Continue with ${label}`} title={`Continue with ${label}`} className="flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-white/80 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"><Icon /></a>)}</div>;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otp, setOtp] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get("email")?.trim().toLowerCase() || getPendingVerificationEmail();
    if (queryEmail) setEmail(queryEmail);
    const requestedMode = params.get("mode");
    if (requestedMode === "signup" || requestedMode === "verify" || requestedMode === "otp") setMode(requestedMode);
    const mfa = params.get("mfa");
    if (mfa) { setChallengeToken(mfa); setMode("mfa"); setMessage("MFA is enabled. enter the current code from your authenticator app."); }
    const oauthError = params.get("oauth_error");
    if (oauthError) setError(oauthError);
    if (params.get("created") === "1") { setMode("verify"); setMessage("account created. verify your email to finish setup."); }
  }, []);

  function switchMode(next: Mode) { setMode(next); setError(""); setMessage(""); setOtp(""); router.replace(next === "signin" ? "/login" : `/login?mode=${next}${email ? `&email=${encodeURIComponent(email.trim().toLowerCase())}` : ""}`); }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); const cleanEmail = email.trim().toLowerCase(); if (!emailPattern.test(cleanEmail)) return setError("enter a valid email address"); if (!password) return setError("enter your password"); setLoading(true); const result = await login(cleanEmail, password); setLoading(false); if (!result.ok) return setError(result.error || "invalid email or password"); if (result.mfaRequired) { setChallengeToken(result.challengeToken); setMode("mfa"); setMessage("MFA is enabled. enter the current code from your authenticator app."); return; } router.push("/onboarding");
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); const cleanUsername = username.trim(); const cleanEmail = email.trim().toLowerCase(); if (!usernamePattern.test(cleanUsername)) return setError("username must be 3-32 letters, numbers, or underscores"); if (!emailPattern.test(cleanEmail)) return setError("enter a valid email address"); if (password.length < 6) return setError("password must be at least 6 characters"); if (password.length > 128) return setError("password must be 128 characters or fewer"); if (!acceptedTerms) return setError("you must accept the Terms of Service to create an account"); setLoading(true); const result = await register(cleanUsername, cleanEmail, password, { termsAccepted: true, termsVersion: "2026-09-08" }); setLoading(false); if (!result.ok) return setError(result.error || "account could not be created"); setEmail(cleanEmail); setMode("verify"); setMessage("account created. enter the verification code sent to your email."); router.replace(`/login?mode=verify&email=${encodeURIComponent(cleanEmail)}`);
  }

  async function handleLoginOtpRequest() {
    setError(""); setMessage(""); const cleanEmail = email.trim().toLowerCase(); if (!emailPattern.test(cleanEmail)) return setError("enter a valid email address"); setLoading(true); const result = await requestLoginOtp(cleanEmail); setLoading(false); if (!result.ok) return setError(result.error || "sign-in code could not be sent"); setMessage("if the account exists, a 6-digit sign-in code has been sent to your email.");
  }

  async function handleOtpLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); const cleanEmail = email.trim().toLowerCase(); if (!emailPattern.test(cleanEmail)) return setError("enter a valid email address"); if (!/^\d{6}$/.test(otp)) return setError("enter the 6-digit sign-in code"); setLoading(true); const result = await verifyLoginOtp(cleanEmail, otp); setLoading(false); if (!result.ok) return setError(result.error || "invalid or expired sign-in code"); if (result.mfaRequired) { setChallengeToken(result.challengeToken); setMode("mfa"); setMessage("MFA is enabled. enter the current code from your authenticator app."); return; } router.push("/onboarding");
  }

  async function handleVerificationRequest() {
    setError(""); setMessage(""); const cleanEmail = email.trim().toLowerCase(); if (!emailPattern.test(cleanEmail)) return setError("enter a valid email address"); setLoading(true); const result = await requestOtp(cleanEmail); setLoading(false); if (!result.ok) return setError(result.error || "verification email could not be sent right now"); setMessage(`verification code sent to ${cleanEmail}`);
  }

  async function handleVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); const cleanEmail = email.trim().toLowerCase(); if (!emailPattern.test(cleanEmail)) return setError("enter a valid email address"); if (!/^\d{6}$/.test(otp)) return setError("enter the 6-digit verification code"); setLoading(true); const result = await verifyOtp(cleanEmail, otp); setLoading(false); if (!result.ok) return setError(result.error || "invalid or expired verification code"); router.push("/onboarding");
  }

  async function handleMfa(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); if (!/^\d{6}$/.test(mfaCode)) return setError("enter the 6-digit MFA code"); setLoading(true); const result = await verifyMfaLogin(challengeToken, mfaCode); setLoading(false); if (!result.ok) return setError(result.error || "MFA verification failed"); router.push("/onboarding"); }

  const title = mode === "signup" ? "create your account" : mode === "verify" ? "verify your email" : mode === "otp" ? "sign in with a code" : mode === "mfa" ? "one more step" : "welcome back";
  const subtitle = mode === "signup" ? "Everything you need to start using BobAI." : mode === "verify" ? `We sent a 6-digit code to ${email || "your email"}.` : mode === "otp" ? "No password needed. We’ll email you a one-time sign-in code." : mode === "mfa" ? "Verify the second factor to finish signing in." : "Sign in to your BobAI workspace.";

  return <main className="flex min-h-screen items-center justify-center bg-[#080a0d] px-4 py-6 text-white"><div className="w-full max-w-[390px]"><Link href="/" className="mb-6 flex items-center justify-center gap-2.5"><BobLogo /><div><p className="text-base font-semibold">Bob AI</p><p className="text-[11px] text-white/35">your AI workspace</p></div></Link><section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 sm:p-6"><div className="mb-5"><h1 className="text-2xl font-black tracking-tight">{title}</h1><p className="mt-1.5 text-xs leading-5 text-white/45">{subtitle}</p></div>

    {mode === "signin" && <><SocialButtons /><div className="my-4 flex items-center gap-3 text-[9px] uppercase tracking-[0.22em] text-white/25"><span className="h-px flex-1 bg-white/10" /><span>or</span><span className="h-px flex-1 bg-white/10" /></div><form onSubmit={handlePasswordLogin} className="space-y-3"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" type="email" autoComplete="email" required className="h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-sm outline-none transition focus:border-cyan-300/40" /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="password" required className="h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-sm outline-none transition focus:border-cyan-300/40" /><button disabled={loading} className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-50">{loading ? "checking..." : "sign in"}</button></form><button type="button" onClick={() => switchMode("otp")} className="mt-3 w-full text-xs text-cyan-300 hover:text-cyan-200">forgot your password? use an email code</button></>}

    {mode === "signup" && <form onSubmit={handleSignup} className="space-y-3"><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" autoComplete="username" minLength={3} maxLength={32} required className="h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-sm outline-none transition focus:border-cyan-300/40" /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="email" autoComplete="email" required className="h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-sm outline-none transition focus:border-cyan-300/40" /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="password" autoComplete="new-password" minLength={6} maxLength={128} required className="h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-sm outline-none transition focus:border-cyan-300/40" /><p className="text-[11px] text-white/30">6–128 characters.</p><label className="flex items-start gap-2.5 text-xs leading-5 text-white/45"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0" required /><span>I agree to the <Link href="/terms" target="_blank" className="text-cyan-300">Terms</Link> and <Link href="/privacy" target="_blank" className="text-cyan-300">Privacy Policy</Link>.</span></label><button type="submit" disabled={loading || !acceptedTerms} className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-50">{loading ? "creating..." : "create account"}</button></form>}

    {mode === "otp" && <form onSubmit={handleOtpLogin} className="space-y-3"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" type="email" autoComplete="email" required className="h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-sm outline-none transition focus:border-cyan-300/40" /><button type="button" onClick={() => void handleLoginOtpRequest()} disabled={loading} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] text-sm font-semibold disabled:opacity-50">{loading ? "sending..." : "send email code"}</button><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} className="h-12 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-center text-lg tracking-[0.35em] outline-none focus:border-cyan-300/40" /><button disabled={loading || otp.length !== 6} className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black disabled:opacity-50">{loading ? "signing in..." : "sign in with code"}</button></form>}

    {mode === "verify" && <form onSubmit={handleVerification} className="space-y-3"><input value={email} onChange={(event) => setEmail(event.target.value.toLowerCase())} type="email" placeholder="email" autoComplete="email" required className="h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-sm outline-none focus:border-cyan-300/40" /><button type="button" onClick={() => void handleVerificationRequest()} disabled={loading} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.045] text-sm font-semibold disabled:opacity-50">{loading ? "sending..." : "send verification code"}</button><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} className="h-12 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-center text-lg tracking-[0.35em] outline-none focus:border-cyan-300/40" /><button type="submit" disabled={loading || otp.length !== 6} className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black disabled:opacity-50">{loading ? "checking..." : "verify email"}</button></form>}

    {mode === "mfa" && <form onSubmit={handleMfa} className="space-y-3"><input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit MFA code" maxLength={6} autoFocus className="h-12 w-full rounded-xl border border-white/10 bg-black/15 px-3.5 text-center text-lg tracking-[0.35em] outline-none focus:border-cyan-300/40" /><button disabled={loading} className="h-11 w-full rounded-xl bg-cyan-300 text-sm font-bold text-black disabled:opacity-50">{loading ? "verifying..." : "verify MFA"}</button></form>}

    {message && <p className="mt-3 text-xs leading-5 text-white/50">{message}</p>}{error && <p className="mt-3 text-xs leading-5 text-red-400">{error}</p>}
    {mode !== "mfa" && <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-xs text-white/40">{mode === "signin" ? <><button type="button" onClick={() => switchMode("signup")} className="hover:text-white">create account</button><button type="button" onClick={() => switchMode("verify")} className="hover:text-white">verify email</button></> : <><button type="button" onClick={() => switchMode("signin")} className="hover:text-white">back to sign in</button>{mode !== "signup" && <button type="button" onClick={() => switchMode("signup")} className="hover:text-white">create account</button>}</>}</div>}
  </section></div></main>;
}
