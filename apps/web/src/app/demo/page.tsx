"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NeuralShell from "@/components/neural/NeuralShell";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import ChatWindow from "@/components/ChatWindow";
import { setAssistantActivity, useAssistantState, type AssistantVisualState } from "@/lib/assistantState";
import type { ChatMessage } from "@/types/chat";

/**
 * Demo mode. Everything on this page is hard-coded sample content held in local React state: it never calls
 * the API, never signs anyone in, and never reads or writes real conversations. It exists so the interface
 * can be shown (and visually tested) even when no backend or local model is running.
 */
const SAMPLE: ChatMessage[] = [
  { id: "demo-u1", role: "user", content: "Give me a quick Python example for reading a CSV and averaging a column." },
  {
    id: "demo-a1",
    role: "assistant",
    content: "Here's a short version using only the standard library:\n\n```python\nimport csv\n\ndef column_average(path: str, column: str) -> float:\n    with open(path, newline=\"\") as handle:\n        values = [float(row[column]) for row in csv.DictReader(handle) if row[column]]\n    return sum(values) / len(values) if values else 0.0\n\nprint(column_average(\"sales.csv\", \"amount\"))  # e.g. 42.5\n```\n\n**How it works**\n\n1. `csv.DictReader` maps each row to a dictionary keyed by the header.\n2. Empty cells are skipped, so a blank row doesn't crash the average.\n3. The function returns `0.0` for an empty file instead of dividing by zero.\n\nFor large files, `pandas.read_csv(path)[column].mean()` is faster.",
  },
  { id: "demo-u2", role: "user", content: "What's the weather in Hyderabad right now?" },
  {
    id: "demo-a2",
    role: "assistant",
    content: "Sample answer (demo data, not a real reading): it is **31 °C and partly cloudy** in Hyderabad, Telangana, feeling like 34 °C with 58% humidity. Today's range is 23–32 °C with a 20% chance of rain.",
    liveData: { kind: "weather", provider: "Open-Meteo (demo sample)", fetchedAt: "2026-10-22T06:30:00.000Z", cached: false, freshness: "live", sources: [{ title: "Open-Meteo forecast API", url: "https://open-meteo.com/" }] },
  },
  { id: "demo-u3", role: "user", content: "Open the project page in the browser agent and check it loads." },
  {
    id: "demo-a3",
    role: "assistant",
    content: "Jarvis wants to use browser agent. Approve it below to run it once, or decline.",
    approval: { tool: "browser", name: "browser agent", risk: "external", arguments: { url: "https://example.com" }, workspaceId: "00000000-0000-4000-8000-000000000000", state: "pending" },
  },
];

const STATES: AssistantVisualState[] = ["idle", "listening", "thinking", "speaking"];

export default function DemoPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE);
  const [showConversation, setShowConversation] = useState(true);
  const current = useAssistantState();

  useEffect(() => () => { for (const source of ["voice-input", "voice-output", "request", "stream"] as const) setAssistantActivity(source, false); }, []);

  function show(state: AssistantVisualState) {
    setAssistantActivity("voice-input", state === "listening");
    setAssistantActivity("stream", state === "speaking");
    setAssistantActivity("request", state === "thinking");
    setAssistantActivity("voice-output", false);
  }

  return (
    <NeuralShell
      sidebar={
        <div className="flex h-full flex-col gap-4 p-5">
          <p className="caption">Demo mode</p>
          <h1 className="font-display text-3xl leading-tight">Sample data, <em className="text-[var(--accent)]">nothing real.</em></h1>
          <p className="text-sm leading-6 text-[var(--muted)]">This page never contacts the server. Nothing you do here is saved or mixed with real conversations.</p>
          <Link href="/login" className="btn-ink mt-auto justify-center text-sm">Sign in for the real Jarvis</Link>
        </div>
      }
      topbar={<NeuralTopbar caption="Demo · sample data" />}
      composer={
        <div className="mx-auto flex w-full max-w-[820px] flex-wrap items-center gap-2" role="toolbar" aria-label="Demo controls">
          <span className="caption mr-1">Core state</span>
          {STATES.map((state) => (
            <button key={state} type="button" onClick={() => show(state)} aria-pressed={current === state} className="atelier-chip capitalize">{state}</button>
          ))}
          <button type="button" onClick={() => setShowConversation((value) => !value)} className="atelier-chip ml-auto">
            {showConversation ? "Show empty chat" : "Show sample chat"}
          </button>
        </div>
      }
    >
      <div className="caption pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-[var(--accent)] bg-[var(--bg)] px-3 py-1 !text-[var(--accent)]">Demo · sample data</div>
      <ChatWindow
        messages={showConversation ? messages : []}
        loading={false}
        onPinMessage={(id) => setMessages((list) => list.map((message) => message.id === id ? { ...message, pinned: !message.pinned } : message))}
        onDeleteMessage={(id) => setMessages((list) => list.filter((message) => message.id !== id))}
        onResolveApproval={(id, approve) => setMessages((list) => {
          const updated = list.map((message) => message.id === id && message.approval ? { ...message, approval: { ...message.approval, state: approve ? "completed" as const : "declined" as const } } : message);
          if (!approve) return updated;
          // Sample result so "the result is below" is true in the demo too.
          const at = updated.findIndex((message) => message.id === id);
          const result = { id: `${id}-result`, role: "assistant" as const, content: "Opened **example.com** (demo result): the page loaded fine and its title is *Example Domain*." };
          return updated.some((message) => message.id === result.id) ? updated : [...updated.slice(0, at + 1), result, ...updated.slice(at + 1)];
        })}
        browserVoice
      />
    </NeuralShell>
  );
}
