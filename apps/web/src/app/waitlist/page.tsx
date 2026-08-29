import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = { title: "Waitlist | Bob AI", description: "Join the Bob AI early-access waitlist." };

export default function WaitlistPage() {
  return <main className="min-h-screen overflow-auto px-6 pb-20 pt-28"><div className="mx-auto max-w-xl"><Breadcrumbs current="Waitlist" /><h1 className="text-4xl font-bold tracking-tight">join the waitlist</h1><p className="mt-3 text-white/55">early access can be enabled when the production launch plan is ready.</p><form action="/thank-you" className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[.03] p-6"><label className="block text-sm font-medium">email<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" placeholder="you@example.com" /></label><button className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:-translate-y-0.5">Join waitlist</button><p className="text-xs text-white/35">This form is a launch-ready UI; connect it to a real waitlist endpoint/provider before accepting real signups.</p></form></div></main>;
}
