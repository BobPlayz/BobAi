import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="grid min-h-screen place-items-center px-6 pt-24 text-center">
      <section className="max-w-lg">
        <p className="caption !text-[var(--accent)]">404</p>
        <h1 className="font-display mt-4 text-5xl leading-none sm:text-6xl">That page drifted <em className="text-[var(--accent)]">off the map.</em></h1>
        <p className="mt-4 text-[var(--muted)]">The page you asked for doesn&apos;t exist or moved somewhere else.</p>
        <Link href="/" className="btn-ink mt-8">Back home</Link>
      </section>
    </main>
  );
}
