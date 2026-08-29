import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";

export const metadata = { title: "About | Bob AI", description: "Learn what Bob AI is building." };

export default function AboutPage() {
  return <main className="min-h-screen overflow-auto px-6 pb-20 pt-28"><div className="mx-auto max-w-4xl"><Breadcrumbs current="About" /><h1 className="text-4xl font-bold tracking-tight">about bob ai</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-white/60">Bob AI is being built as a practical AI workspace: one place for conversation, research, creation, files, and developer tools.</p><div className="mt-10 grid gap-4 sm:grid-cols-3">{[["chat", "reason through ideas and tasks"],["create", "work with images, audio, video and design capabilities"],["build", "code, test and deploy with AI-assisted workflows"]].map(([title, text]) => <article key={title} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-white/50">{text}</p></article>)}</div><div className="mt-10 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.04] p-6"><h2 className="font-semibold">the team</h2><p className="mt-2 text-sm leading-6 text-white/55">Bob AI is currently a focused independent project. A real team photo will be added when there is a team to photograph — no AI-generated people pretending to be the team.</p></div><Link href="/contact" className="mt-8 inline-flex rounded-xl border border-white/10 px-5 py-3 font-semibold hover:bg-white/5">Contact</Link></div></main>;
}
