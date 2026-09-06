import { runChat } from "./chatEngine.js";

const MAX_SOURCE_LENGTH = 80_000;
const MAX_TOPIC_LENGTH = 1_000;
const MAX_ITEMS = 30;

type StudyPack = {
  title: string;
  summary: string;
  keyPoints: string[];
  flashcards: Array<{ question: string; answer: string }>;
  quiz: Array<{ question: string; options: string[]; answer: string; explanation: string }>;
  weakAreas: string[];
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parsePack(content: string): StudyPack {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? content;
  const parsed = JSON.parse(fenced) as Record<string, unknown>;
  const list = (value: unknown) => Array.isArray(value) ? value : [];
  const flashcards = list(parsed.flashcards).slice(0, MAX_ITEMS).map((item) => {
    const value = item as Record<string, unknown>;
    return { question: text(value.question, 500), answer: text(value.answer, 2_000) };
  }).filter((item) => item.question && item.answer);
  const quiz = list(parsed.quiz).slice(0, MAX_ITEMS).map((item) => {
    const value = item as Record<string, unknown>;
    const options = list(value.options).map((option) => text(option, 500)).filter(Boolean).slice(0, 6);
    return { question: text(value.question, 1_000), options, answer: text(value.answer, 500), explanation: text(value.explanation, 2_000) };
  }).filter((item) => item.question && item.options.length >= 2 && item.answer);
  return {
    title: text(parsed.title, 500) || "Study pack",
    summary: text(parsed.summary, 8_000),
    keyPoints: list(parsed.keyPoints).map((item) => text(item, 1_000)).filter(Boolean).slice(0, MAX_ITEMS),
    flashcards,
    quiz,
    weakAreas: list(parsed.weakAreas).map((item) => text(item, 1_000)).filter(Boolean).slice(0, MAX_ITEMS),
  };
}

export async function createStudyPack(input: { source: unknown; topic?: unknown; difficulty?: unknown }): Promise<StudyPack> {
  const source = text(input.source, MAX_SOURCE_LENGTH);
  if (!source) throw new Error("study source is required");
  const topic = text(input.topic, MAX_TOPIC_LENGTH) || "the supplied material";
  const difficulty = text(input.difficulty, 100) || "mixed";
  const prompt = `Create a study pack from the supplied material. Do not invent facts that are not supported by the material.\nTopic: ${topic}\nDifficulty: ${difficulty}\nReturn ONLY valid JSON with this exact shape: {"title":"string","summary":"string","keyPoints":["string"],"flashcards":[{"question":"string","answer":"string"}],"quiz":[{"question":"string","options":["string"],"answer":"string","explanation":"string"}],"weakAreas":["string"]}.\nMaterial:\n${source}`;
  const response = await runChat([{ role: "system", content: "You are BobAI Study Mode. Ground every generated item in the supplied material." }, { role: "user", content: prompt }]);
  try {
    return parsePack(response.message.content);
  } catch {
    throw new Error("study model returned invalid structured output");
  }
}
