import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 pt-24 text-center">
      <section className="max-w-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">404</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">that page drifted into the void</h1>
        <p className="mt-4 text-white/55">the page you requested doesn&apos;t exist or moved somewhere else.</p>
        <Link href="/" className="mt-8 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:-translate-y-0.5">Back home</Link>
      </section>
    </main>
  );
}
