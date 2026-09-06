"use client";

import { useEffect, useMemo, useState } from "react";
import { createArtifact, createProject, deepResearch, listProjects, runCodingAgent, studyPack, updateProject } from "@/lib/api";

type Project = { id: string; name: string; description?: string | null; settings?: unknown };
type Mode = "research" | "study" | "create" | "voice" | "agent";
type Props = { personality: string; onPersonalityChange: (value: string) => void };

export default function AssistantHub({ personality, onPersonalityChange }: Props) {
  const [mode, setMode] = useState<Mode>("research");
  const [query, setQuery] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [memory, setMemory] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectInstructions, setProjectInstructions] = useState("");
  const [artifact, setArtifact] = useState("");
  const [quiz, setQuiz] = useState<Array<{ question: string; options: string[]; answer: number }>>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  useEffect(() => { void listProjects().then((items) => { setProjects(items); if (items[0]) selectProject(items[0]); }).catch(() => undefined); }, []);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem("bobai.settings.v1") || "{}"); if (typeof saved.memory === "boolean") setMemory(saved.memory); } catch {} }, []);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem("bobai.settings.v1") || "{}"); localStorage.setItem("bobai.settings.v1", JSON.stringify({ ...saved, memory })); } catch { localStorage.setItem("bobai.settings.v1", JSON.stringify({ memory })); } }, [memory]);

  function selectProject(project: Project) {
    setProjectId(project.id); setProjectName(project.name);
    const settings = project.settings && typeof project.settings === "object" ? project.settings as Record<string, unknown> : {};
    setProjectInstructions(typeof settings.instructions === "string" ? settings.instructions : "");
  }

  async function saveProject() {
    if (!projectName.trim()) return;
    setBusy(true);
    try {
      if (projectId) {
        const updated = await updateProject(projectId, { name: projectName, instructions: projectInstructions });
        setProjects((items) => items.map((item) => item.id === projectId ? updated : item));
      } else {
        const created = await createProject({ name: projectName, instructions: projectInstructions });
        setProjects((items) => [created, ...items]); selectProject(created);
      }
    } catch (error) { setOutput(error instanceof Error ? error.message : "project save failed"); }
    finally { setBusy(false); }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { setOutput("voice playback is not supported by this browser"); return; }
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  function startVoice() {
    const Recognition = (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void } }).webkitSpeechRecognition;
    if (!Recognition) { setOutput("voice input needs a browser with SpeechRecognition support"); return; }
    const recognition = new Recognition(); recognition.lang = "en-IN"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = (event) => setQuery(event.results[0]?.[0]?.transcript || ""); recognition.onend = () => setListening(false); setListening(true); recognition.start();
  }

  function clearResults() { setOutput(""); setArtifact(""); setQuiz([]); setQuizAnswers({}); }

  async function run() {
    const text = query.trim(); if (!text || busy) return;
    setBusy(true); clearResults();
    try {
      if (mode === "research") {
        const result = await deepResearch(text);
        setOutput(`${result.answer}\n\nSources:\n${result.sources.slice(0, 12).map((source, index) => `[${index + 1}] ${source.title} — ${source.url}`).join("\n")}`);
        setArtifact(result.answer);
      } else if (mode === "study") {
        const result = await studyPack(text, "medium");
        setQuiz(result.quiz);
        setOutput(`${result.title}\n\n${result.summary}\n\nKey points:\n${result.keyPoints.map((item) => `• ${item}`).join("\n")}\n\nFlashcards:\n${result.flashcards.map((card) => `Q: ${card.question}\nA: ${card.answer}`).join("\n\n")}`);
      } else if (mode === "create") setArtifact(await createArtifact(text, personality));
      else if (mode === "voice") { speak(text); setOutput("speaking…"); }
      else { const result = await runCodingAgent(text); setOutput(result.output + (result.warnings ? `\n\nWarnings:\n${result.warnings}` : "")); }
    } catch (error) { setOutput(error instanceof Error ? error.message : "that operation failed"); }
    finally { setBusy(false); }
  }

  const modes = useMemo(() => [["research", "Deep Research"], ["study", "Study"], ["create", "Create"], ["voice", "Voice"], ["agent", "Agent"]] as Array<[Mode, string]>, []);

  return (
    <section className="border-b border-[#2A3340] bg-[#0E141B]/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        {modes.map(([id, label]) => <button key={id} onClick={() => { setMode(id); clearResults(); }} className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${mode === id ? "border-[#38BDF8]/50 bg-[#38BDF8]/10 text-[#E5EEF7]" : "border-[#2A3340] bg-[#141A22] text-[#94A3B8] hover:text-[#E5EEF7]"}`}>{label}</button>)}
        <button onClick={() => setMemory((value) => !value)} className="ml-auto rounded-xl border border-[#2A3340] px-3 py-2 text-xs text-[#94A3B8]">Memory {memory ? "on" : "off"}</button>
        <button onClick={startVoice} className="rounded-xl border border-[#2A3340] px-3 py-2 text-xs text-[#94A3B8]">{listening ? "Listening…" : "🎙 Voice input"}</button>
      </div>

      <div className="mx-auto mt-3 grid max-w-5xl gap-3 lg:grid-cols-[1fr_260px]">
        <div className="rounded-2xl border border-[#2A3340] bg-[#10161D] p-3">
          <div className="mb-2 text-xs text-[#64748B]">{mode === "research" ? "Research, compare, synthesize and cite — not just a search dump." : mode === "study" ? "Turn notes or a topic into a study pack and score yourself." : mode === "create" ? "Generate an artifact, then edit it directly below." : mode === "voice" ? "Type text to hear it, or use voice input above." : "Give the coding agent a concrete task."}</div>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="what should Bob do?" className="min-h-20 w-full resize-y rounded-xl border border-[#2A3340] bg-[#141A22] p-3 text-sm text-[#E5EEF7] outline-none placeholder:text-[#64748B] focus:border-[#38BDF8]" />
          <div className="mt-2 flex justify-end"><button onClick={run} disabled={busy || !query.trim()} className="rounded-xl bg-[#38BDF8] px-4 py-2 text-sm font-semibold text-[#061018] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Working…" : "Run"}</button></div>
          {artifact && <div className="mt-3 rounded-xl border border-[#2A3340] bg-[#0B0F14] p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-[#94A3B8]">Editable artifact</span><button onClick={() => navigator.clipboard?.writeText(artifact)} className="rounded-lg border border-[#2A3340] px-2 py-1 text-xs text-[#94A3B8]">Copy</button></div><textarea value={artifact} onChange={(event) => setArtifact(event.target.value)} className="min-h-72 w-full resize-y rounded-lg border border-[#2A3340] bg-[#10161D] p-3 font-mono text-xs leading-5 text-[#CBD5E1] outline-none focus:border-[#38BDF8]" /><button onClick={() => speak(artifact)} className="mt-2 rounded-lg border border-[#2A3340] px-3 py-2 text-xs text-[#94A3B8]">🔊 Read aloud</button></div>}
          {quiz.length > 0 && <div className="mt-3 space-y-3 rounded-xl border border-[#2A3340] bg-[#0B0F14] p-4 text-sm text-[#CBD5E1]"><div className="font-semibold text-[#E5EEF7]">Interactive quiz</div>{quiz.map((item, index) => <div key={index} className="rounded-lg border border-[#2A3340] p-3"><div>{index + 1}. {item.question}</div><div className="mt-2 grid gap-1">{item.options.map((option, optionIndex) => <button key={optionIndex} onClick={() => setQuizAnswers((answers) => ({ ...answers, [index]: optionIndex }))} className={`rounded-lg px-2 py-1 text-left text-xs ${quizAnswers[index] === optionIndex ? "bg-[#38BDF8]/15 text-[#E5EEF7]" : "bg-[#141A22] text-[#94A3B8]"}`}>{option}</button>)}</div>{quizAnswers[index] !== undefined && <div className={`mt-2 text-xs ${quizAnswers[index] === item.answer ? "text-green-400" : "text-red-400"}`}>{quizAnswers[index] === item.answer ? "✓ Correct" : `✗ Correct answer: ${item.options[item.answer]}`}</div>}</div>)}</div>}
          {output && <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-[#2A3340] bg-[#0B0F14] p-3 text-xs leading-5 text-[#CBD5E1]">{output}</pre>}
        </div>

        <div className="rounded-2xl border border-[#2A3340] bg-[#10161D] p-3">
          <div className="mb-2 text-xs font-semibold text-[#E5EEF7]">Projects</div>
          <select value={projectId} onChange={(event) => { const project = projects.find((item) => item.id === event.target.value); if (project) selectProject(project); }} className="w-full rounded-xl border border-[#2A3340] bg-[#141A22] p-2 text-xs text-[#E5EEF7]"><option value="">New project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" className="mt-2 w-full rounded-xl border border-[#2A3340] bg-[#141A22] p-2 text-xs text-[#E5EEF7]" />
          <textarea value={projectInstructions} onChange={(event) => setProjectInstructions(event.target.value)} placeholder="Project instructions / knowledge rules" className="mt-2 h-24 w-full resize-none rounded-xl border border-[#2A3340] bg-[#141A22] p-2 text-xs text-[#E5EEF7]" />
          <button onClick={saveProject} disabled={busy || !projectName.trim()} className="mt-2 w-full rounded-xl border border-[#38BDF8]/30 px-3 py-2 text-xs text-[#38BDF8] disabled:opacity-40">Save project</button>
          <label className="mt-3 block text-xs text-[#64748B]">Personality override</label><input value={personality} onChange={(event) => onPersonalityChange(event.target.value)} placeholder="short, casual, detailed…" className="mt-1 w-full rounded-xl border border-[#2A3340] bg-[#141A22] p-2 text-xs text-[#E5EEF7]" />
        </div>
      </div>
    </section>
  );
}
