import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = { title: "Thank You | Bob AI", description: "Thanks for getting in touch with Bob AI." };

export default function ThankYouPage() {
  return <main className="min-h-screen overflow-auto px-6 pb-20 pt-28"><div className="mx-auto max-w-2xl"><Breadcrumbs current="Thank you" /><div className="rounded-3xl border border-cyan-300/10 bg-white/[.03] p-8"><p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">received</p><h1 className="mt-4 text-4xl font-bold tracking-tight">thanks for reaching out</h1><p className="mt-4 leading-7 text-white/55">your form submission reached the thank-you page. connect the production form endpoint before treating this as confirmed delivery.</p><Link href="/" className="mt-8 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Back home</Link></div></div></main>;
}
