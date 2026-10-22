import Link from "next/link";

export default function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="caption mb-8">
      <Link href="/" className="hover:text-[var(--text)]">Home</Link>
      <span aria-hidden="true" className="mx-2">/</span>
      <span aria-current="page" className="text-[var(--text)]">{current}</span>
    </nav>
  );
}
