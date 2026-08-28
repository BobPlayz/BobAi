"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    const ok = await login(email.trim(), password);
    setLoading(false);
    if (!ok) {
      setError("invalid credentials or backend unavailable");
      return;
    }
    router.push("/onboarding");
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3">
          <BobLogo />
          <div><h1 className="text-xl font-semibold">bobai</h1><p className="text-sm text-white/45">alpha</p></div>
        </div>
        <h2 className="text-4xl font-black tracking-tight">welcome back</h2>
        <p className="mt-2 text-white/60">log in to connect this client to your BobAI session</p>
        <div className="mt-8 space-y-4">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" onKeyDown={(e) => { if (e.key === "Enter") void handleLogin(); }} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={() => void handleLogin()} disabled={loading} className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "logging in..." : "log in"}
          </button>
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <Link href="/signup" className="hover:text-white">create account</Link>
          <Link href="/verify-otp" className="hover:text-white">use otp</Link>
        </div>
      </div>
    </main>
  );
}
