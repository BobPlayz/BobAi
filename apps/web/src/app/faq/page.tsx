import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = { title: "FAQ | Bob AI", description: "Frequently asked questions about Bob AI." };

const faqs = [
  ["what is bob ai?", "Bob AI is an AI workspace for chatting, research, creation, files, and developer workflows."],
  ["can bob ai use local models?", "Yes. The backend is designed around provider abstractions so local AI services can be connected during development."],
  ["does bob ai support files?", "The existing backend includes authenticated upload and file-processing infrastructure."],
  ["can bob ai search the web?", "The architecture includes research and web-search capabilities. A production search provider still needs to be configured before launch."],
  ["is my data public?", "Bob AI's application routes are designed around authentication and resource authorization. Production deployment still requires a final security and privacy review."],
];

export default function FAQPage() {
  return <main className="min-h-screen overflow-auto px-6 pb-20 pt-28"><div className="mx-auto max-w-4xl"><Breadcrumbs current="FAQ" /><h1 className="text-4xl font-bold tracking-tight">frequently asked questions</h1><p className="mt-3 text-white/55">the useful stuff, without the corporate fog machine.</p><div className="mt-10 space-y-3">{faqs.map(([q, a]) => <details key={q} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-3 leading-7 text-white/55">{a}</p></details>)}</div><Link href="/chat" className="mt-10 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Try Bob AI</Link></div></main>;
}
