"use client";

import { type FormEvent, useEffect, useState } from "react";
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

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("email");
    if (value) setEmail(value);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
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
      if (result.verificationRequired) {
        router.push(`/verify-otp?email=${encodeURIComponent(cleanEmail)}`);
        return;
      }
      setError("invalid credentials or backend unavailable");
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
        <p className="mt-2 text-white/60">log in to connect this client to your BobAI session</p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="password"
            required
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "logging in..." : "log in"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <Link href="/signup" className="hover:text-white">create account</Link>
          <Link href="/verify-otp" className="hover:text-white">verify email</Link>
        </div>
      </div>
    </main>
  );
}
