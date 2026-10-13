import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";
import { useTheme } from "@/components/neural/ThemeProvider";

export const metadata = {
  title: "About | Bob AI",
  description: "Learn what Bob AI is building and who publishes it.",
};

export default function AboutPage() {
  const { theme } = useTheme();
  const light = theme === "light";
  const colors = light
    ? { page: "bg-[#f7f8fa] text-[#202123]", muted: "text-[#5f6672]", panel: "border-[#e5e7eb] bg-white", link: "border-[#d1d5db] hover:bg-[#f3f4f6]" }
    : { page: "bg-[#08090b] text-white", muted: "text-white/60", panel: "border-white/10 bg-white/[0.03]", link: "border-white/10 hover:bg-white/5" };

  return (
    <main className={`min-h-screen overflow-auto px-6 pb-20 pt-28 ${colors.page}`}>
      <div className="mx-auto max-w-4xl">
        <Breadcrumbs current="About" />
        <h1 className="text-4xl font-bold tracking-tight">about bob ai</h1>
        <p className={`mt-5 max-w-2xl text-lg leading-8 ${colors.muted}`}>
          Bob AI is being built as a practical AI workspace for conversation, research, creation, files, and developer tools.
        </p>
        <p className={`mt-3 text-sm ${colors.muted}`}>Published by <strong className={light ? "text-[#202123]" : "text-white"}>Origin Productions</strong>.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["chat", "reason through ideas and tasks"],
            ["create", "work with supported image, audio, and design capabilities"],
            ["build", "use AI-assisted coding and development workflows"],
          ].map(([title, text]) => (
            <article key={title} className={`rounded-2xl border p-5 ${colors.panel}`}>
              <h2 className="font-semibold">{title}</h2>
              <p className={`mt-2 text-sm leading-6 ${colors.muted}`}>{text}</p>
            </article>
          ))}
        </div>
        <div className={`mt-10 rounded-2xl border p-6 ${colors.panel}`}>
          <h2 className="font-semibold">the team</h2>
          <p className={`mt-2 text-sm leading-6 ${colors.muted}`}>
            Bob AI is an independent project published by Origin Productions. The public beta will only describe features that are actually available and verified.
          </p>
        </div>
        <Link href="/contact" className={`mt-8 inline-flex rounded-xl border px-5 py-3 font-semibold ${colors.link}`}>Contact</Link>
      </div>
    </main>
  );
}
