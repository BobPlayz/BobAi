"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";
import { register } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setError("");
    setLoading(true);
    const result = await register(username.trim(), email.trim().toLowerCase(), password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "account could not be created");
      return;
    }
    router.push("/verify-otp");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 text-white">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3"><BobLogo /><div><h1 className="text-xl font-semibold">bobai</h1><p className="text-sm text-white/45">alpha</p></div></div>
        <h2 className="text-4xl font-black tracking-tight">create account</h2>
        <p className="mt-2 text-white/60">create your BobAI account and verify your email</p>
        <div className="mt-8 space-y-4">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoComplete="username" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email" autoComplete="email" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password (12+ characters)" autoComplete="new-password" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={() => void handleSignup()} disabled={loading} className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "creating..." : "create account"}</button>
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-white/50"><Link href="/login" className="hover:text-white">already have an account?</Link><Link href="/verify-otp" className="hover:text-white">verify with otp</Link></div>
      </div>
    </main>
  );
}
