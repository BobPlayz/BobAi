"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";
import { signup } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  function handleSignup() {
    signup(username.trim() || "user", email.trim() || "user@local");
    router.push("/chat");
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3">
          <BobLogo />
          <div>
            <h1 className="text-xl font-semibold">bobai</h1>
            <p className="text-sm text-white/45">alpha</p>
          </div>
        </div>

        <h2 className="text-4xl font-black tracking-tight">create account</h2>
        <p className="mt-2 text-white/60">
          temporary local account until otp auth is built
        </p>

        <div className="mt-8 space-y-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-white/35"
          />

          <button
            onClick={handleSignup}
            className="w-full rounded-2xl bg-white py-3 font-semibold text-black hover:bg-gray-200 transition"
          >
            create account
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <Link href="/login" className="hover:text-white">
            already have an account?
          </Link>

          <Link href="/verify-otp" className="hover:text-white">
            verify with otp
          </Link>
        </div>
      </div>
    </main>
  );
}