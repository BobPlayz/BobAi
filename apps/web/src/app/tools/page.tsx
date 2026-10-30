"use client";

import AuthGate from "@/components/AuthGate";
import { request } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Project = { id: string; name: string; description?: string | null; settings?: { instructions?: string }; updatedAt?: string };
type Reminder = { id: string; title: string; message?: string | null; remindAt: string; isCompleted: boolean };
type Prompt = { id: string; name: string; prompt: string; updatedAt?: string };
type StudyPack = { title: string; summary: string; keyPoints: string[]; flashcards: { question: string; answer: string }[]; quiz: { question: string; options: string[]; answer: string; explanation: string }[]; weakAreas: string[] };
type Tab = "projects" | "reminders" | "prompts" | "study";
const tabs: { id: Tab; label: string; description: string }[] = [
  { id: "projects", label: "Projects", description: "Keep instructions and work organised." },
  { id: "reminders", label: "Reminders", description: "Keep track of things you need to do." },
  { id: "prompts", label: "Saved prompts", description: "Reuse prompts without hunting through old chats." },
  { id: "study", label: "Study packs", description: "Turn your notes into revision material." },
];

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1.5 block font-medium">{label}</span>{children}</label>;
}
const inputClass = "min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text)]";
const panelClass = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5";

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectInstructions, setProjectInstructions] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [promptName, setPromptName] = useState("");
  const [promptText, setPromptText] = useState("");
  const [studyTopic, setStudyTopic] = useState("");
  const [studySource, setStudySource] = useState("");
  const [studyDifficulty, setStudyDifficulty] = useState("mixed");
  const [studyPack, setStudyPack] = useState<StudyPack | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, r, s] = await Promise.all([
        json<{ projects: Project[] }>("/projects"),
        json<{ reminders: Reminder[] }>("/reminders"),
        json<{ prompts: Prompt[] }>("/prompts"),
      ]);
      setProjects(p.projects || []);
      setReminders(r.reminders || []);
      setPrompts(s.prompts || []);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load your workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: FormEvent, action: () => Promise<void>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  async function createProject(event: FormEvent) {
    await submit(event, async () => {
      await json("/projects", { method: "POST", body: JSON.stringify({ name: projectName, description: projectDescription, instructions: projectInstructions }) });
      setProjectName(""); setProjectDescription(""); setProjectInstructions(""); setNotice("Project created."); await refresh();
    });
  }
  async function createReminder(event: FormEvent) {
    await submit(event, async () => {
      if (!reminderAt || new Date(reminderAt).getTime() <= Date.now()) throw new Error("Choose a future date and time.");
      await json("/reminders", { method: "POST", body: JSON.stringify({ title: reminderTitle, message: reminderMessage, remindAt: new Date(reminderAt).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, channels: ["in_app"] }) });
      setReminderTitle(""); setReminderMessage(""); setReminderAt(""); setNotice("Reminder saved."); await refresh();
    });
  }
  async function createPrompt(event: FormEvent) {
    await submit(event, async () => {
      await json("/prompts", { method: "POST", body: JSON.stringify({ name: promptName, prompt: promptText }) });
      setPromptName(""); setPromptText(""); setNotice("Prompt saved."); await refresh();
    });
  }
  async function completeReminder(reminder: Reminder) {
    setBusy(true); setError(""); setNotice("");
    try {
      await json(`/reminders/${encodeURIComponent(reminder.id)}`, { method: "PATCH", body: JSON.stringify({ isCompleted: !reminder.isCompleted }) });
      await refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not update reminder."); }
    finally { setBusy(false); }
  }
  async function deleteItem(path: string, label: string) {
    setBusy(true); setError(""); setNotice("");
    try { await json(path, { method: "DELETE" }); setNotice(`${label} deleted.`); await refresh(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : `Could not delete ${label.toLowerCase()}.`); }
    finally { setBusy(false); }
  }
  async function generateStudyPack(event: FormEvent) {
    await submit(event, async () => {
      const result = await json<StudyPack>("/study/pack", { method: "POST", body: JSON.stringify({ source: studySource, topic: studyTopic, difficulty: studyDifficulty }) });
      setStudyPack(result); setRevealed([]); setQuizAnswers({}); setNotice("Your study pack is ready.");
    });
  }

  return <AuthGate><main className="min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text)] sm:px-8 sm:py-10">
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/chat" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Back to chat</Link><p className="mt-4 caption">YOUR WORKSPACE</p><h1 className="mt-1 font-display text-4xl sm:text-5xl">Tools & library</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">Projects, reminders, reusable prompts and study packs, all in one place.</p></div>
        <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="btn-line !min-h-10 text-sm">Refresh</button>
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Workspace tools">
        {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`shrink-0 rounded-full border px-4 py-2.5 text-sm transition ${tab === item.id ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"}`}>{item.label}</button>)}
      </div>
      <p className="mb-5 text-sm text-[var(--muted)]">{tabs.find(item => item.id === tab)?.description}</p>
      {error && <div role="alert" className="mb-4 rounded-xl border border-[var(--danger)]/40 bg-[var(--surface)] p-3 text-sm">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{notice}</div>}
      {loading ? <div className={panelClass}>Loading your workspace…</div> : <>
        {tab === "projects" && <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createProject} className={panelClass + " space-y-3"}><h2 className="font-display text-2xl">New project</h2><Field label="Project name"><input required maxLength={200} value={projectName} onChange={e => setProjectName(e.target.value)} className={inputClass} placeholder="e.g. Science exhibition" /></Field><Field label="Description"><textarea maxLength={2000} value={projectDescription} onChange={e => setProjectDescription(e.target.value)} className={inputClass + " min-h-20"} placeholder="What is this project about?" /></Field><Field label="Instructions for Jarvis"><textarea maxLength={12000} value={projectInstructions} onChange={e => setProjectInstructions(e.target.value)} className={inputClass + " min-h-28"} placeholder="Optional context and instructions" /></Field><button disabled={busy || !projectName.trim()} className="btn-ink w-full justify-center text-sm">{busy ? "Saving…" : "Create project"}</button></form>
          <section className="space-y-3"><h2 className="font-display text-2xl">Your projects <span className="text-base text-[var(--muted)]">({projects.length})</span></h2>{projects.length ? projects.map(project => <article key={project.id} className={panelClass}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{project.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{project.description || "No description yet."}</p>{project.settings?.instructions && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-[var(--muted)]">Instructions: {project.settings.instructions}</p>}</div><button type="button" disabled={busy} onClick={() => void deleteItem(`/projects/${encodeURIComponent(project.id)}`, "Project")} className="text-xs text-[var(--danger)]">Archive</button></div></article>) : <div className={panelClass + " text-sm text-[var(--muted)]"}>No projects yet. Create one to keep related work together.</div>}</section>
        </div>}
        {tab === "reminders" && <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createReminder} className={panelClass + " space-y-3"}><h2 className="font-display text-2xl">New reminder</h2><Field label="What should Jarvis remind you about?"><input required maxLength={200} value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} className={inputClass} placeholder="Finish science notes" /></Field><Field label="Extra details"><textarea maxLength={5000} value={reminderMessage} onChange={e => setReminderMessage(e.target.value)} className={inputClass + " min-h-20"} placeholder="Optional details" /></Field><Field label="Date and time"><input required type="datetime-local" value={reminderAt} onChange={e => setReminderAt(e.target.value)} className={inputClass} /></Field><p className="text-xs text-[var(--muted)]">Saved in your local timezone. Reminders appear in Jarvis; external notifications depend on notification delivery being configured.</p><button disabled={busy || !reminderTitle.trim() || !reminderAt} className="btn-ink w-full justify-center text-sm">{busy ? "Saving…" : "Save reminder"}</button></form>
          <section className="space-y-3"><h2 className="font-display text-2xl">Your reminders</h2>{reminders.length ? reminders.map(reminder => <article key={reminder.id} className={panelClass + " flex items-start gap-3"}><input aria-label={`Mark ${reminder.title} complete`} type="checkbox" checked={reminder.isCompleted} onChange={() => void completeReminder(reminder)} disabled={busy} className="mt-1 h-4 w-4 accent-[var(--text)]" /><div className="min-w-0 flex-1"><p className={reminder.isCompleted ? "line-through text-[var(--muted)]" : "font-medium"}>{reminder.title}</p>{reminder.message && <p className="mt-1 text-sm text-[var(--muted)]">{reminder.message}</p>}<p className="mt-2 text-xs text-[var(--muted)]">{new Date(reminder.remindAt).toLocaleString()}</p></div><button type="button" disabled={busy} onClick={() => void deleteItem(`/reminders/${encodeURIComponent(reminder.id)}`, "Reminder")} className="text-xs text-[var(--danger)]">Delete</button></article>) : <div className={panelClass + " text-sm text-[var(--muted)]"}>Nothing scheduled. Add a reminder when you need one.</div>}</section>
        </div>}
        {tab === "prompts" && <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createPrompt} className={panelClass + " space-y-3"}><h2 className="font-display text-2xl">Save a prompt</h2><Field label="Name"><input required maxLength={120} value={promptName} onChange={e => setPromptName(e.target.value)} className={inputClass} placeholder="Explain simply" /></Field><Field label="Prompt"><textarea required maxLength={20000} value={promptText} onChange={e => setPromptText(e.target.value)} className={inputClass + " min-h-40"} placeholder="Write a prompt you want to reuse…" /></Field><button disabled={busy || !promptName.trim() || !promptText.trim()} className="btn-ink w-full justify-center text-sm">{busy ? "Saving…" : "Save prompt"}</button></form>
          <section className="space-y-3"><h2 className="font-display text-2xl">Saved prompts <span className="text-base text-[var(--muted)]">({prompts.length})</span></h2>{prompts.length ? prompts.map(prompt => <article key={prompt.id} className={panelClass}><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{prompt.name}</h3><div className="flex gap-3"><button type="button" onClick={() => { void navigator.clipboard.writeText(prompt.prompt).then(() => setNotice("Prompt copied."), () => setError("Clipboard access was blocked.")); }} className="text-xs underline">Copy</button><button type="button" disabled={busy} onClick={() => void deleteItem(`/prompts/${encodeURIComponent(prompt.id)}`, "Prompt")} className="text-xs text-[var(--danger)]">Delete</button></div></div><p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm text-[var(--muted)]">{prompt.prompt}</p></article>) : <div className={panelClass + " text-sm text-[var(--muted)]"}>Save prompts you use often and they’ll be here.</div>}</section>
        </div>}
        {tab === "study" && <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
          <form onSubmit={generateStudyPack} className={panelClass + " h-fit space-y-3"}><h2 className="font-display text-2xl">Build a study pack</h2><Field label="Topic"><input value={studyTopic} onChange={e => setStudyTopic(e.target.value)} maxLength={1000} className={inputClass} placeholder="e.g. Photosynthesis" /></Field><Field label="Difficulty"><select value={studyDifficulty} onChange={e => setStudyDifficulty(e.target.value)} className={inputClass}><option value="mixed">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="challenging">Challenging</option></select></Field><Field label="Your notes or study material"><textarea required value={studySource} onChange={e => setStudySource(e.target.value)} maxLength={80000} className={inputClass + " min-h-56"} placeholder="Paste your notes here. Jarvis will base the pack on this material." /></Field><button disabled={busy || !studySource.trim()} className="btn-ink w-full justify-center text-sm">{busy ? "Creating your pack…" : "Generate study pack"}</button><p className="text-xs text-[var(--muted)]">Study packs are generated from the material you provide. Check important facts against your class notes.</p></form>
          {studyPack ? <section className="space-y-4"><div className={panelClass}><p className="caption">YOUR STUDY PACK</p><h2 className="mt-1 font-display text-3xl">{studyPack.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{studyPack.summary}</p>{studyPack.keyPoints.length > 0 && <><h3 className="mt-4 font-semibold">Key points</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{studyPack.keyPoints.map((point, i) => <li key={i}>{point}</li>)}</ul></>}</div>{studyPack.flashcards.length > 0 && <div className={panelClass}><h3 className="font-display text-2xl">Flashcards</h3><div className="mt-3 space-y-2">{studyPack.flashcards.map((card, i) => <button key={i} type="button" onClick={() => setRevealed(current => current.includes(i) ? current.filter(x => x !== i) : [...current, i])} className="w-full rounded-xl border border-[var(--border)] p-3 text-left"><span className="block text-sm font-medium">{card.question}</span>{revealed.includes(i) && <span className="mt-2 block whitespace-pre-wrap text-sm text-[var(--muted)]">{card.answer}</span>}<span className="mt-2 block text-xs text-[var(--muted)]">{revealed.includes(i) ? "Tap to hide answer" : "Tap to reveal answer"}</span></button>)}</div></div>}{studyPack.quiz.length > 0 && <div className={panelClass}><h3 className="font-display text-2xl">Quick quiz</h3><div className="mt-3 space-y-5">{studyPack.quiz.map((question, i) => <fieldset key={i}><legend className="text-sm font-medium">{i + 1}. {question.question}</legend><div className="mt-2 space-y-2">{question.options.map((option, j) => <label key={j} className="flex cursor-pointer items-start gap-2 text-sm"><input type="radio" name={`quiz-${i}`} checked={quizAnswers[i] === option} onChange={() => setQuizAnswers(current => ({ ...current, [i]: option }))} className="mt-1" />{option}</label>)}</div>{quizAnswers[i] && <p className={`mt-2 text-sm ${quizAnswers[i] === question.answer ? "text-[var(--success)]" : "text-[var(--muted)]"}`}>{quizAnswers[i] === question.answer ? "Correct." : `Answer: ${question.answer}`} {question.explanation}</p>}</fieldset>)}</div></div>}{studyPack.weakAreas.length > 0 && <div className={panelClass}><h3 className="font-semibold">Review these areas</h3><ul className="mt-2 list-disc pl-5 text-sm">{studyPack.weakAreas.map((area, i) => <li key={i}>{area}</li>)}</ul></div>}</section> : <div className={panelClass + " flex min-h-64 items-center justify-center text-center text-sm text-[var(--muted)]"}>Your study pack will appear here after generation.</div>}
        </div>}
      </>}
    </div>
  </main></AuthGate>;
}
