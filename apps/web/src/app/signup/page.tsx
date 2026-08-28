"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";
import { register } from "@/lib/auth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[A-Za-z0-9_]{3,32}$/;

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!usernamePattern.test(cleanUsername)) {
      setError("username must be 3-32 letters, numbers, or underscores");
      return;
    }
    if (!emailPattern.test(cleanEmail)) {
      setError("enter a valid email address");
      return;
    }
    if (password.length < 12) {
      setError("password must be at least 12 characters");
      return;
    }
    if (password.length > 128) {
      setError("password must be 128 characters or fewer");
      return;
    }

    setLoading(true);
    const result = await register(cleanUsername, cleanEmail, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error || "account could not be created");
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

        <h2 className="text-4xl font-black tracking-tight">create account</h2>
        <p className="mt-2 text-white/60">create your BobAI account</p>

        <form onSubmit={handleSignup} className="mt-8 space-y-4">
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" autoComplete="username" minLength={3} maxLength={32} required className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="email" autoComplete="email" required className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="password (12+ characters)" autoComplete="new-password" minLength={12} maxLength={128} required className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-white/25 placeholder:text-white/35" />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-white py-3 font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "creating..." : "create account"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <Link href="/login" className="hover:text-white">already have an account?</Link>
          <Link href={`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`} className="hover:text-white">verify email</Link>
        </div>
      </div>
    </main>
  );
}
