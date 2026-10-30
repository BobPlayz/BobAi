"use client";

import Link from "next/link";

import NeuralShell from "@/components/neural/NeuralShell";
import NeuralTopbar from "@/components/neural/NeuralTopbar";
import ChatWindow from "@/components/ChatWindow";
import type { ChatMessage } from "@/types/chat";

/** A clearly labelled preview conversation. It does not send messages or save chat history. */
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
  { id: "demo-u3", role: "user", content: "Can you help me plan a simple personal website?" },
  { id: "demo-a3", role: "assistant", content: "Absolutely. We can shape it around a short introduction, a projects section, and a contact area. I can help with the layout, wording and code, then put the pieces together into a working page." },
];


export default function DemoPage() {
  const messages = SAMPLE;

  return (
    <NeuralShell
      sidebar={
        <div className="flex h-full flex-col gap-4 p-5">
          <p className="caption">A quick preview</p>
          <h1 className="font-display text-3xl leading-tight">Meet <em className="text-[var(--accent)]">Jarvis.</em></h1>
          <p className="text-sm leading-6 text-[var(--muted)]">Explore a sample conversation covering coding, live information and everyday planning. This preview does not save messages.</p>
          <Link href="/login" className="btn-ink mt-auto justify-center text-sm">Start using Jarvis</Link>
        </div>
      }
      topbar={<NeuralTopbar caption="Demo · sample data" />}
      composer={
        <div className="mx-auto w-full max-w-[820px] text-center text-xs text-[var(--muted)]">
          Sample conversation · try Jarvis for a live chat
        </div>
      }
    >
      <div className="caption pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-[var(--accent)] bg-[var(--bg)] px-3 py-1 !text-[var(--accent)]">Demo · sample data</div>
      <ChatWindow
        messages={messages}
        loading={false}
        browserVoice
      />
    </NeuralShell>
  );
}
