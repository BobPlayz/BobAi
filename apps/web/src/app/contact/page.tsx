import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata = { title: "Contact | Bob AI", description: "Contact the Bob AI project." };

export default function ContactPage() {
  return <main className="min-h-screen overflow-auto px-6 pb-20 pt-28"><div className="mx-auto max-w-2xl"><Breadcrumbs current="Contact" /><h1 className="text-4xl font-bold tracking-tight">contact bob ai</h1><p className="mt-3 text-white/55">have feedback, a bug report, or a serious idea? send it through the project&apos;s configured contact channel.</p><div className="mt-8 rounded-2xl border border-white/10 bg-white/[.03] p-6"><p className="text-sm leading-7 text-white/60">A public contact address is intentionally not hard-coded into the application. Configure the production contact destination before launch so messages do not disappear into a dead inbox.</p></div></div></main>;
}
