"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BobLogo from "@/components/BobLogo";
import Stepper, { Step } from "@/components/Stepper";
import GooeyNav from "@/components/GooeyNav";
import { hasCompletedOnboarding, isLoggedIn, saveOnboarding } from "@/lib/auth";

type OnboardingAnswers = { name: string; usage: string; personality: string; responseStyle: string; interests: string[] };
const initialAnswers: OnboardingAnswers = { name: "", usage: "", personality: "", responseStyle: "", interests: [] };
const usageOptions = ["learning and studying", "coding and building projects", "creative work", "research and exploring ideas", "everyday assistance"];
const personalityOptions = ["friendly and casual", "professional and focused", "fun and energetic", "calm and thoughtful", "direct and no-nonsense"];
const responseStyleOptions = ["short and concise", "balanced", "detailed and thorough", "step-by-step"];
const interestOptions = ["technology", "science", "gaming", "movies and tv", "music", "art and design", "business", "school and education"];

function ChoiceButton({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={`onboarding-choice ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selected}>{children}<span aria-hidden="true">{selected ? "✓" : "+"}</span></button>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers);

  useEffect(() => { if (!isLoggedIn()) router.replace("/login"); else if (hasCompletedOnboarding()) router.replace("/chat"); }, [router]);

  function updateAnswer<K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) { setAnswers((current) => ({ ...current, [key]: value })); }
  function toggleInterest(interest: string) { setAnswers((current) => ({ ...current, interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest] })); }
  function complete() { saveOnboarding(answers); router.push("/chat"); }

  return <main className="onboarding-page">
    <div className="onboarding-heading">
      <div className="onboarding-brand"><BobLogo /><span>bobai</span><small>SETUP / 01</small></div>
      <p className="onboarding-kicker">personalization protocol</p>
      <h1>make the conversation<br /><em>feel like yours.</em></h1>
      <p className="onboarding-intro">A few quick choices give bobai a useful starting point. Nothing is permanent.</p>
    </div>
    <Stepper initialStep={1} nextButtonText="Continue" backButtonText="Back" onFinalStepCompleted={complete} renderStepNavigation={(currentStep, goTo) => <div className="onboarding-nav"><GooeyNav items={["01", "02", "03", "04", "05", "06"]} activeIndex={currentStep - 1} onChange={(index) => goTo(index + 1)} /></div>}>
      <Step><Question number="01" title="What should bobai call you?" description="This is how bobai will address you."><input className="onboarding-input" value={answers.name} onChange={(event) => updateAnswer("name", event.target.value)} placeholder="Your name" autoComplete="given-name" /></Question></Step>
      <Step><Question number="02" title="What brings you here most often?" description="Choose the closest fit."><div className="choice-grid">{usageOptions.map((option) => <ChoiceButton key={option} selected={answers.usage === option} onClick={() => updateAnswer("usage", option)}>{option}</ChoiceButton>)}</div></Question></Step>
      <Step><Question number="03" title="How should bobai sound?" description="Pick the personality that feels natural."><div className="choice-grid">{personalityOptions.map((option) => <ChoiceButton key={option} selected={answers.personality === option} onClick={() => updateAnswer("personality", option)}>{option}</ChoiceButton>)}</div></Question></Step>
      <Step><Question number="04" title="How much detail do you want?" description="bobai will tune its answers around this preference."><div className="choice-grid">{responseStyleOptions.map((option) => <ChoiceButton key={option} selected={answers.responseStyle === option} onClick={() => updateAnswer("responseStyle", option)}>{option}</ChoiceButton>)}</div></Question></Step>
      <Step><Question number="05" title="What are you into?" description="Choose as many as you like."><div className="choice-grid">{interestOptions.map((option) => <ChoiceButton key={option} selected={answers.interests.includes(option)} onClick={() => toggleInterest(option)}>{option}</ChoiceButton>)}</div></Question></Step>
      <Step><Question number="06" title="Your starting profile" description="You can change any of these preferences later."><div className="summary">{[["name", answers.name || "Not provided"], ["main use", answers.usage || "Not selected"], ["personality", answers.personality || "Not selected"], ["response style", answers.responseStyle || "Not selected"], ["interests", answers.interests.join(", ") || "None selected"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></Question></Step>
    </Stepper>
    <style jsx>{`
      .onboarding-page {
        min-height: 100vh;
        overflow: auto;
        padding: 58px 24px 72px;
        color: var(--text);
      }

      .onboarding-heading {
        width: min(100%, 760px);
        margin: 0 auto 26px;
      }

      .onboarding-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--text);
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: .02em;
      }

      .onboarding-brand :global(svg) { width: 28px; height: 28px; }
      .onboarding-brand small { margin-left: auto; color: var(--accent); font: 600 .68rem/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .14em; }
      .onboarding-kicker { margin: 52px 0 12px; color: var(--accent); font: 600 .7rem/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .18em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(2.4rem, 6vw, 4.7rem); line-height: .98; letter-spacing: -.06em; font-weight: 800; }
      h1 em { color: var(--accent); font-style: normal; }
      .onboarding-intro { max-width: 500px; margin: 18px 0 0; color: var(--muted); line-height: 1.6; }
      .onboarding-step { min-height: 300px; display: flex; flex-direction: column; justify-content: center; }
      .step-label { margin-bottom: 14px; color: var(--accent); font: 600 .72rem/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .16em; }
      h2 { margin: 0; color: var(--text); font-size: clamp(1.55rem, 4vw, 2.35rem); line-height: 1.08; letter-spacing: -.045em; }
      .onboarding-step > p { margin: 12px 0 26px; color: var(--muted); line-height: 1.55; }
      .onboarding-input { width: 100%; border: 1px solid rgba(255,255,255,.14); border-radius: 14px; padding: 16px 17px; outline: none; background: rgba(255,255,255,.045); color: var(--text); font: inherit; transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease; }
      .onboarding-input::placeholder { color: rgba(238,244,251,.32); }
      .onboarding-input:focus { border-color: var(--accent); background: rgba(56,189,248,.06); box-shadow: 0 0 0 4px rgba(56,189,248,.1); }
      .choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .onboarding-choice { display: flex; min-height: 56px; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 14px 16px; background: rgba(255,255,255,.035); color: rgba(238,244,251,.72); font: inherit; text-align: left; cursor: pointer; transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, color 180ms ease; }
      .onboarding-choice span { color: rgba(238,244,251,.35); font-size: 1.1rem; }
      .onboarding-choice:hover { transform: translateY(-1px); border-color: rgba(56,189,248,.55); color: var(--text); }
      .onboarding-choice.selected { border-color: var(--accent); background: rgba(56,189,248,.12); color: var(--text); box-shadow: inset 3px 0 var(--accent); }
      .onboarding-choice.selected span { color: var(--accent); }
      .summary { display: grid; gap: 0; }
      .summary div { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,.08); }
      .summary span { color: var(--muted); font-size: .82rem; text-transform: capitalize; }
      .summary strong { max-width: 68%; color: var(--text); font-size: .9rem; font-weight: 500; text-align: right; }
      @media (max-width: 600px) { .onboarding-page { padding: 30px 14px 48px; } .onboarding-kicker { margin-top: 38px; } .onboarding-brand small { font-size: .58rem; } .choice-grid { grid-template-columns: 1fr; } .onboarding-step { min-height: 350px; } }
    `}</style>
  </main>;
}

function Question({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <div className="onboarding-step"><span className="step-label">{number}</span><h2>{title}</h2><p>{description}</p>{children}</div>;
}