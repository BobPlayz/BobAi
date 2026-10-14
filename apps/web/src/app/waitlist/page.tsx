import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = { title: "Waitlist | Jarvis", description: "Join the Jarvis early-access waitlist." };

export default function WaitlistPage() {
  return <main className="min-h-screen overflow-auto px-6 pb-20 pt-28"><div className="mx-auto max-w-xl"><Breadcrumbs current="Waitlist" /><h1 className="text-4xl font-bold tracking-tight">join the waitlist</h1><p className="mt-3 text-white/55">early access can be enabled when the production launch plan is ready.</p><section className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[.03] p-6"><p className="text-sm leading-7 text-white/60">The waitlist is not accepting signups yet. No email address is collected or sent anywhere from this page. Please check back after the production waitlist is connected.</p><button type="button" disabled className="w-full cursor-not-allowed rounded-xl bg-cyan-300/40 px-5 py-3 font-semibold text-slate-950/60" aria-disabled="true">Waitlist not open yet</button></section></div></main>;
}
