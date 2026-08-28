"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => null) as { error?: string } | null;
        setError(result?.error || "account could not be created");
        return;
      }
      router.push(`/login?email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError("backend unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3"><BobLogo /><div><h1 className="text-xl font-semibold">bobai</h1><p className="text-sm text-white/45">alpha</p></div></div>
        <h2 className="text-4xl font-black tracking-tight">create account</h2>
        <p className="mt-2 text-white/60">create a real BobAI account</p>
        <div className="mt-8 space-y-4">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password (12+ characters)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={() => void handleSignup()} disabled={loading} className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50">{loading ? "creating..." : "create account"}</button>
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-white/50"><Link href="/login" className="hover:text-white">already have an account?</Link><Link href="/verify-otp" className="hover:text-white">verify with otp</Link></div>
      </div>
    </main>
  );
}
