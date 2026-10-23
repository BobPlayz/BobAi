"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { getPendingVerificationName, getSession, hasCompletedOnboarding, saveOnboarding } from "@/lib/auth";
import { savePreferences } from "@/lib/preferences";
import { generationForYear, type GenerationId } from "@/lib/generation";
import { LANGUAGES, isLanguageId, languageLabel, type LanguageId } from "@/lib/language";

const QUESTIONS = {
  usage: { title: "What'll you mostly use Jarvis for?", options: ["Learning and homework", "Coding and building projects", "Creative work", "Research and exploring ideas", "Everyday help"] },
  personality: { title: "Pick Jarvis's vibe", options: ["Friendly and casual", "Professional and focused", "Fun and energetic", "Calm and thoughtful", "Direct and no-nonsense"] },
  detail: { title: "Short answers or the full story?", options: ["Short and to the point", "Balanced", "Detailed and thorough", "Step by step"] },
} as const;
const INTERESTS = ["Technology", "Science", "Gaming", "Movies & TV", "Music", "Art & design", "Sport", "School"];
const STEPS = ["name", "language", "year", "usage", "personality", "detail", "interests", "done"] as const;
type Step = (typeof STEPS)[number];

/** A sample of how Jarvis will text each generation, shown on the last screen. */
const SAMPLE: Record<GenerationId | "none", string> = {
  "gen-alpha": "yo NAME! ready when u are. what are we doing today? 🚀",
  "gen-z": "ayy NAME, we're all set fr. what's on ur mind?",
  millennial: "Hey NAME! All set up 🙌 What can I help with?",
  "gen-x": "All set, NAME. What do you need?",
  boomer: "Hello NAME, everything is ready. How can I help you today?",
  silent: "Good day, NAME. Everything is ready. Please tell me how I can help.",
  none: "Hey NAME, you're all set. What can I help with?",
};

type Answers = { name: string; language: LanguageId; birthYear: string; usage: string; personality: string; detail: string; interests: string[] };

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

/** The browser's language if Jarvis supports it, otherwise English. */
function browserLanguage(): LanguageId {
  if (typeof navigator === "undefined") return "en";
  const code = (navigator.language || "en").slice(0, 2).toLowerCase();
  return isLanguageId(code) ? code : "en";
}

function Chip({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className="atelier-chip !min-h-12 !px-5 text-[15px]">{children}</button>;
}

const field = "mt-6 h-14 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 text-lg outline-none focus:border-[var(--text)]";

function Onboarding() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({ name: "", language: "en", birthYear: "", usage: "", personality: "", detail: "", interests: [] });
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const advanceTimer = useRef<number | undefined>(undefined);
  const step: Step = STEPS[index];
  const generation = generationForYear(Number(answers.birthYear));
  const yearInvalid = answers.birthYear.length === 4 && !generation;

  useEffect(() => { if (hasCompletedOnboarding()) router.replace("/chat"); }, [router]);
  useEffect(() => {
    // Start from what we already know: the name typed at sign-in and the browser's language.
    const known = getPendingVerificationName() || getSession()?.username || "";
    setAnswers((current) => ({ ...current, language: browserLanguage(), name: current.name || (known.includes("@") ? "" : known.slice(0, 60)) }));
  }, []);
  // Each new question takes focus: its text box if it has one, otherwise its heading (for screen readers).
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("[data-step-input]");
    if (input) input.focus(); else if (index > 0) heading.current?.focus();
  }, [index]);
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  function set<K extends keyof Answers>(key: K, value: Answers[K]) { setAnswers((current) => ({ ...current, [key]: value })); }
  function next() { window.clearTimeout(advanceTimer.current); setIndex((value) => Math.min(value + 1, STEPS.length - 1)); }
  function back() { window.clearTimeout(advanceTimer.current); setIndex((value) => Math.max(value - 1, 0)); }
  /** Single-choice answers move on by themselves after a beat, so it feels quick. */
  function choose(key: "usage" | "personality" | "detail", option: string) {
    const selected = answers[key] === option ? "" : option;
    set(key, selected);
    window.clearTimeout(advanceTimer.current);
    if (selected) advanceTimer.current = window.setTimeout(next, 280);
  }
  function finish(skip = false) {
    // Only the generation is kept; the birth year itself is never stored or sent.
    if (skip) savePreferences({ language: answers.language });
    else savePreferences({ personality: toPersonality(answers), language: answers.language, ...(generation ? { generation: generation.id } : {}) });
    saveOnboarding(answers);
    router.push("/chat");
  }

  const canContinue = step !== "year" || !yearInvalid;
  const name = answers.name.trim() || "there";
  const progress = Math.round((index / (STEPS.length - 1)) * 100);

  let title: ReactNode;
  let hint: ReactNode = null;
  let body: ReactNode;
  switch (step) {
    case "name":
      title = <>Hey! What should Jarvis <em className="text-[var(--accent)]">call you?</em></>;
      hint = "A name or nickname is fine. Takes about 30 seconds, and you can change everything later in Settings.";
      body = <input data-step-input value={answers.name} onChange={(event) => set("name", event.target.value.slice(0, 60))} autoComplete="given-name" placeholder="Your name or nickname" aria-label="Your name or nickname" className={field} />;
      break;
    case "language":
      title = <>Which language should Jarvis <em className="text-[var(--accent)]">reply in?</em></>;
      hint = "Jarvis sticks to this one. You can still ask it to translate stuff.";
      body = (
        <div role="radiogroup" aria-label="Reply language" className="mt-6 flex flex-wrap gap-2">
          {LANGUAGES.map((language) => (
            <button key={language.id} type="button" role="radio" aria-checked={answers.language === language.id} aria-pressed={answers.language === language.id} onClick={() => set("language", language.id)} className="atelier-chip !min-h-12 !px-5 text-[15px]">
              {language.name}{language.native !== language.name && <span lang={language.id} className="opacity-70">{language.native}</span>}
            </button>
          ))}
        </div>
      );
      break;
    case "year":
      title = <>What year were you <em className="text-[var(--accent)]">born?</em></>;
      hint = "Jarvis texts you the way your generation does. Only your generation gets saved, never the year.";
      body = (
        <>
          <input data-step-input value={answers.birthYear} onChange={(event) => set("birthYear", event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="bday-year" placeholder="e.g. 2013" aria-label="Birth year" aria-invalid={yearInvalid} aria-describedby="onboarding-generation" className={`${field} max-w-xs`} />
          <p id="onboarding-generation" aria-live="polite" className="mt-4 min-h-6 text-[15px]">
            {generation ? <>That makes you <strong className="text-[var(--accent)]">{generation.label}</strong>, so Jarvis will keep it {generation.vibe}.</> : yearInvalid ? <span className="text-[var(--muted)]">Hmm, that year doesn&apos;t look right.</span> : null}
          </p>
        </>
      );
      break;
    case "usage": case "personality": case "detail":
      title = QUESTIONS[step].title;
      hint = "Tap one. Tap again to unpick it.";
      body = (
        <div className="mt-6 flex flex-wrap gap-2">
          {QUESTIONS[step].options.map((option) => <Chip key={option} selected={answers[step] === option} onClick={() => choose(step, option)}>{option}</Chip>)}
        </div>
      );
      break;
    case "interests":
      title = <>What are you <em className="text-[var(--accent)]">into?</em></>;
      hint = "Pick as many as you want. Jarvis uses these for examples and ideas.";
      body = (
        <div className="mt-6 flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <Chip key={interest} selected={answers.interests.includes(interest)} onClick={() => set("interests", answers.interests.includes(interest) ? answers.interests.filter((item) => item !== interest) : [...answers.interests, interest])}>{interest}</Chip>
          ))}
        </div>
      );
      break;
    case "done":
      title = <>You&apos;re all set, <em className="text-[var(--accent)]">{name}.</em></>;
      hint = "Here's how Jarvis will talk to you:";
      body = (
        <div className="mt-6 space-y-4">
          <div className="max-w-md rounded-3xl rounded-bl-md border border-[var(--hairline)] bg-[var(--surface)] px-5 py-4 text-lg shadow-[var(--shadow)]">
            {SAMPLE[generation?.id ?? "none"].replace("NAME", name)}
          </div>
          <ul className="flex flex-wrap gap-2 text-sm text-[var(--muted)]">
            <li className="atelier-chip">{languageLabel(answers.language)}</li>
            {generation && <li className="atelier-chip">{generation.label}</li>}
            {answers.personality && <li className="atelier-chip">{answers.personality}</li>}
            {answers.detail && <li className="atelier-chip">{answers.detail}</li>}
          </ul>
        </div>
      );
      break;
  }

  return (
    <main id="main" tabIndex={-1} className="relative z-[1] flex min-h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <div className="sticky top-0 z-10 bg-[var(--bg)]">
        <div className="h-1 w-full bg-[var(--surface-2)]" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full bg-[var(--accent)] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:px-8">
          <p className="caption">{step === "done" ? "Done" : `Step ${index + 1} of ${STEPS.length - 1}`}</p>
          {step !== "done" && <button type="button" onClick={() => finish(true)} className="caption min-h-11 underline-offset-4 hover:underline">Skip setup</button>}
        </div>
      </div>

      <form
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-8 pt-8 sm:px-8 sm:pt-16"
        onSubmit={(event) => { event.preventDefault(); if (step === "done") finish(); else if (canContinue) next(); }}
      >
        <section key={step} className="flex-1 animate-[chatEnter_380ms_ease-out_both] motion-reduce:animate-none">
          <h1 ref={heading} tabIndex={-1} className="font-display text-4xl leading-[1.02] !outline-none sm:text-6xl">{title}</h1>
          {hint && <p className="mt-3 max-w-xl leading-7 text-[var(--muted)]">{hint}</p>}
          {body}
        </section>

        <div className="sticky bottom-0 -mx-5 mt-10 flex items-center gap-3 border-t border-[var(--hairline)] bg-[var(--bg)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:static sm:mx-0 sm:px-0">
          {index > 0 && <button type="button" onClick={back} className="btn-line">Back</button>}
          <button type="submit" disabled={!canContinue} className="btn-ink ml-auto disabled:opacity-50">
            {step === "done" ? "Let's go" : step === "name" && !answers.name.trim() ? "Skip" : "Next"} <span className="btn-arrow" aria-hidden>→</span>
          </button>
        </div>
      </form>
    </main>
  );
}

export default function OnboardingPage() {
  return <AuthGate requireOnboarding={false}><Onboarding /></AuthGate>;
}
