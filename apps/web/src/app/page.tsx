import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-8 py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">bobai</h1>

          <nav className="flex items-center gap-4 text-sm text-white/70">
            <Link href="/login" className="hover:text-white">
              login
            </Link>
            <Link href="/signup" className="hover:text-white">
              sign up
            </Link>
          </nav>
        </header>

        <section className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.25em] text-white/40">
            built for me and the homies
          </p>

          <h2 className="mt-4 text-6xl font-black tracking-tight sm:text-7xl">
            your ai.
            <br />
            your rules.
          </h2>

          <p className="mt-6 max-w-2xl text-lg text-white/60">
            remembers stuff, learns how you talk, and eventually runs on our own
            model instead of borrowing someone else's brain.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/chat"
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-gray-200"
            >
              open bobai
            </Link>

            <Link
              href="/signup"
              className="text-sm text-white/70 hover:text-white"
            >
              create account
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-4 text-xs text-white/40">
          bobai alpha • localhost • built from scratch
        </footer>
      </div>
    </main>
  );
}