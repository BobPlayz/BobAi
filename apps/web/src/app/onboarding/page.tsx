"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { hasCompletedOnboarding, saveOnboarding } from "@/lib/auth";
import { savePreferences } from "@/lib/preferences";
import { generationForYear } from "@/lib/generation";

const QUESTIONS = {
  usage: { title: "What will you mostly use Jarvis for?", options: ["Learning and homework", "Coding and building projects", "Creative work", "Research and exploring ideas", "Everyday help"] },
  personality: { title: "How should Jarvis sound?", options: ["Friendly and casual", "Professional and focused", "Fun and energetic", "Calm and thoughtful", "Direct and no-nonsense"] },
  detail: { title: "How much detail do you like?", options: ["Short and to the point", "Balanced", "Detailed and thorough", "Step by step"] },
} as const;
const INTERESTS = ["Technology", "Science", "Gaming", "Movies & TV", "Music", "Art & design", "Sport", "School"];

type Answers = { name: string; birthYear: string; usage: string; personality: string; detail: string; interests: string[] };

/** Turns the answers into the personalization text the chat already sends with every message. */
function toPersonality(answers: Answers) {
  const lines = [
    answers.name && `Call me ${answers.name}.`,
    answers.usage && `I mostly use Jarvis for: ${answers.usage.toLowerCase()}.`,
    answers.personality && `Tone: ${answers.personality.toLowerCase()}.`,
    answers.detail && `Answer length: ${answers.detail.toLowerCase()}.`,
    answers.interests.length > 0 && `My interests: ${answers.interests.join(", ").toLowerCase()}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

function Chip({ selected, children, onClick }: { selected: boolean; children: string; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className="atelier-chip !min-h-11 !px-4 text-[15px]">{children}</button>;
}

function Onboarding() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({ name: "", birthYear: "", usage: "", personality: "", detail: "", interests: [] });
  const generation = generationForYear(Number(answers.birthYear));

  useEffect(() => { if (hasCompletedOnboarding()) router.replace("/chat"); }, [router]);

  function set<K extends keyof Answers>(key: K, value: Answers[K]) { setAnswers((current) => ({ ...current, [key]: value })); }
  function finish(skip = false) {
    // Only the generation is kept; the birth year itself is never stored or sent.
    if (!skip) savePreferences({ personality: toPersonality(answers), ...(generation ? { generation: generation.id } : {}) });
    saveOnboarding(answers);
    router.push("/chat");
  }

  return (
    <main id="main" tabIndex={-1} className="relative z-[1] min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
        <p className="caption">Set up · takes 30 seconds · change it any time in Settings</p>
        <h1 className="font-display mt-4 text-5xl leading-[0.95] sm:text-7xl">Make Jarvis <em className="text-[var(--accent)]">yours.</em></h1>

        <form className="mt-12 space-y-12" onSubmit={(event) => { event.preventDefault(); finish(); }}>
          <section>
            <label htmlFor="onboarding-name" className="font-display text-3xl">What should Jarvis call you?</label>
            <input id="onboarding-name" value={answers.name} onChange={(event) => set("name", event.target.value.slice(0, 60))} autoComplete="given-name" placeholder="Your name or nickname" className="mt-4 h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 text-lg outline-none focus:border-[var(--text)]" />
          </section>

          <section>
            <label htmlFor="onboarding-year" className="font-display text-3xl">What year were you born?</label>
            <p className="mt-2 text-[var(--muted)]">Jarvis texts you the way your generation does. Only your generation is saved, not the year.</p>
            <input id="onboarding-year" value={answers.birthYear} onChange={(event) => set("birthYear", event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="bday-year" placeholder="e.g. 2013" aria-describedby="onboarding-generation" className="mt-4 h-14 w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 text-lg outline-none focus:border-[var(--text)]" />
            <p id="onboarding-generation" aria-live="polite" className="mt-3 min-h-6 text-[15px]">
              {generation ? <>That makes you <strong className="text-[var(--accent)]">{generation.label}</strong>, so Jarvis will keep it {generation.vibe}.</> : answers.birthYear.length === 4 ? <span className="text-[var(--muted)]">Hmm, that year doesn&apos;t look right.</span> : null}
            </p>
          </section>

          {(Object.keys(QUESTIONS) as Array<keyof typeof QUESTIONS>).map((key) => (
            <fieldset key={key}>
              <legend className="font-display text-3xl">{QUESTIONS[key].title}</legend>
              <div className="mt-4 flex flex-wrap gap-2">
                {QUESTIONS[key].options.map((option) => (
                  <Chip key={option} selected={answers[key] === option} onClick={() => set(key, answers[key] === option ? "" : option)}>{option}</Chip>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset>
            <legend className="font-display text-3xl">What are you into? <span className="caption align-middle">pick any</span></legend>
            <div className="mt-4 flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <Chip key={interest} selected={answers.interests.includes(interest)} onClick={() => set("interests", answers.interests.includes(interest) ? answers.interests.filter((item) => item !== interest) : [...answers.interests, interest])}>{interest}</Chip>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-8">
            <button type="submit" className="btn-ink">Start chatting <span className="btn-arrow" aria-hidden>→</span></button>
            <button type="button" onClick={() => finish(true)} className="btn-line">Skip for now</button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return <AuthGate requireOnboarding={false}><Onboarding /></AuthGate>;
}
