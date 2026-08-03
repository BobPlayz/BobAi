"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";

export default function VerifyOtpPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3">
          <BobLogo />
          <div>
            <h1 className="text-xl font-semibold">bobai</h1>
            <p className="text-sm text-white/45">otp placeholder</p>
          </div>
        </div>

        <h2 className="text-4xl font-black tracking-tight">verify otp</h2>
        <p className="mt-2 text-white/60">
          enter the 6-digit code sent to your email.
        </p>

        <div className="mt-8 flex justify-between gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <input
              key={i}
              maxLength={1}
              className="h-14 w-12 rounded-2xl border border-white/10 bg-white/5 text-center text-xl outline-none focus:border-white/20"
            />
          ))}
        </div>

        <button
          onClick={() => router.push("/chat")}
          className="mt-8 w-full rounded-2xl bg-white py-3 font-semibold text-black hover:bg-gray-200 transition"
        >
          verify
        </button>

        <div className="mt-6 flex items-center justify-between text-sm text-white/50">
          <Link href="/login" className="hover:text-white">
            back to login
          </Link>

          <button className="hover:text-white">
            resend code
          </button>
        </div>
      </div>
    </main>
  );
}