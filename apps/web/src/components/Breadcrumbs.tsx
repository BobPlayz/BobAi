import Link from "next/link";

export default function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm text-white/45">
      <Link href="/" className="hover:text-white">Home</Link>
      <span aria-hidden="true" className="mx-2">/</span>
      <span className="text-white/75">{current}</span>
    </nav>
  );
}
