import { and, eq, sql } from "drizzle-orm";
import { db, settings } from "@bobai/db";

/**
 * Learns how a user types so Jarvis can text back the same way. Only aggregate numbers and a fixed list of
 * slang words are kept (never message text), it updates with every message so it follows the user's style over
 * time, and the user can turn it off or reset it in Settings. The model itself is not retrained; the profile is
 * turned into a short style instruction for each reply.
 */
export type TypingProfile = {
  version: 1;
  messages: number;
  /** Running averages (0..1 rates, characters for length). */
  avgLength: number;
  lowercase: number;
  emoji: number;
  exclamation: number;
  endPunctuation: number;
  abbreviations: number;
  /** Counts for words from SLANG only. */
  slang: Record<string, number>;
  updatedAt: string;
};

const SLANG = ["fr", "ngl", "lowkey", "highkey", "bet", "bro", "bruh", "lol", "lmao", "lmfao", "fam", "ong", "deadass", "sus", "w", "l", "ratio", "rizz", "slay", "vibe", "vibes", "goated", "mid", "cap", "nocap", "idk", "tbh", "imo", "smh", "fyi", "btw", "omg", "yh", "ye", "yep", "nah", "gonna", "wanna", "kinda", "sorta", "ya", "yall", "y'all", "innit", "mate", "dude", "haha", "hehe", "xd"];
const ABBREVIATIONS = new Set(["u", "ur", "r", "pls", "plz", "thx", "ty", "np", "rn", "tmrw", "msg", "b4", "cuz", "bc", "abt", "wdym", "wbu", "hbu", "idc", "ik", "jk", "k"]);
const SLANG_SET = new Set(SLANG);
const EMOJI = /\p{Extended_Pictographic}/gu;
const MIN_MESSAGES = 3;
const MAX_LEARN_LENGTH = 1_500;
const WEIGHT = 0.2;
const KEY = "typingStyle";

export type MessageFeatures = { length: number; lowercase: boolean; emoji: number; exclamation: boolean; endPunctuation: boolean; abbreviations: number; slang: string[] };

/** Messages that are mostly pasted code, long documents or file contents say nothing about how someone texts. */
export function shouldLearnFrom(text: string) {
  const trimmed = text.trim();
  return trimmed.length >= 2 && trimmed.length <= MAX_LEARN_LENGTH && !/```|^\s*(import|const|function|def|class|<\w+)/m.test(trimmed) && !trimmed.startsWith("file content from ");
}

export function analyzeMessage(text: string): MessageFeatures {
  const trimmed = text.trim();
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  const words = trimmed.toLowerCase().replace(/[’']/g, "'").split(/[^a-z0-9']+/).filter(Boolean);
  return {
    length: trimmed.length,
    lowercase: letters.length > 0 && letters === letters.toLowerCase(),
    emoji: (trimmed.match(EMOJI) || []).length,
    exclamation: trimmed.includes("!"),
    endPunctuation: /[.!?]["')\]]?$/.test(trimmed),
    abbreviations: words.filter((word) => ABBREVIATIONS.has(word)).length,
    slang: [...new Set(words.filter((word) => SLANG_SET.has(word)).concat(/\bno cap\b/i.test(trimmed) ? ["cap"] : []))],
  };
}

const blend = (previous: number, sample: number, count: number) => count < MIN_MESSAGES ? (previous * (count - 1) + sample) / count : previous * (1 - WEIGHT) + sample * WEIGHT;

export function updateProfile(previous: TypingProfile | undefined, features: MessageFeatures, now = new Date()): TypingProfile {
  const base: TypingProfile = previous ?? { version: 1, messages: 0, avgLength: 0, lowercase: 0, emoji: 0, exclamation: 0, endPunctuation: 0, abbreviations: 0, slang: {}, updatedAt: now.toISOString() };
  const count = base.messages + 1;
  const slang = { ...base.slang };
  for (const word of features.slang) slang[word] = (slang[word] ?? 0) + 1;
  // Keep the 15 most used words so the profile stays small.
  const trimmedSlang = Object.fromEntries(Object.entries(slang).sort((a, b) => b[1] - a[1]).slice(0, 15));
  return {
    version: 1,
    messages: Math.min(count, 1_000_000),
    avgLength: blend(base.avgLength, features.length, count),
    lowercase: blend(base.lowercase, features.lowercase ? 1 : 0, count),
    emoji: blend(base.emoji, Math.min(features.emoji, 3) / 3, count),
    exclamation: blend(base.exclamation, features.exclamation ? 1 : 0, count),
    endPunctuation: blend(base.endPunctuation, features.endPunctuation ? 1 : 0, count),
    abbreviations: blend(base.abbreviations, features.abbreviations > 0 ? 1 : 0, count),
    slang: trimmedSlang,
    updatedAt: now.toISOString(),
  };
}

export function isTypingProfile(value: unknown): value is TypingProfile {
  const item = value as TypingProfile | null;
  return Boolean(item) && typeof item === "object" && item!.version === 1 && typeof item!.messages === "number" && typeof item!.avgLength === "number" && typeof item!.slang === "object";
}

/** A short instruction describing the learned style, or "" until there are enough messages to say anything. */
export function describeProfile(profile: TypingProfile | undefined): string {
  if (!profile || profile.messages < MIN_MESSAGES) return "";
  const traits: string[] = [];
  traits.push(profile.avgLength < 40 ? "writes very short messages" : profile.avgLength < 120 ? "writes fairly short messages" : "writes longer, detailed messages");
  if (profile.lowercase > 0.6) traits.push("mostly types in lowercase");
  if (profile.endPunctuation < 0.3) traits.push("usually skips punctuation at the end");
  else if (profile.endPunctuation > 0.7) traits.push("uses full punctuation");
  if (profile.emoji > 0.15) traits.push("often uses emoji");
  else if (profile.emoji < 0.03) traits.push("rarely uses emoji");
  if (profile.exclamation > 0.4) traits.push("is enthusiastic with exclamation marks");
  if (profile.abbreviations > 0.3) traits.push("uses texting abbreviations like u/ur/rn");
  const words = Object.entries(profile.slang).filter(([, count]) => count >= 2).slice(0, 6).map(([word]) => `"${word}"`);
  if (words.length) traits.push(`uses words like ${words.join(", ")}`);
  return `Learned from ${profile.messages} of the user's messages: the user ${traits.join(", ")}. Mirror this style naturally (similar casualness and length; reuse their words sometimes, not in every line). Where this differs from the generation style, follow the user's own style. Keep answers as long as the content really needs.`;
}

export async function loadTypingProfile(userId: string, workspaceId: string): Promise<TypingProfile | undefined> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspaceId), eq(settings.key, KEY))).limit(1);
  return isTypingProfile(row?.value) ? row!.value as TypingProfile : undefined;
}

/** Folds one message into the stored profile and returns the updated profile. */
export async function learnFromMessage(userId: string, workspaceId: string, text: string): Promise<TypingProfile | undefined> {
  if (!shouldLearnFrom(text)) return loadTypingProfile(userId, workspaceId);
  const features = analyzeMessage(text);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`setting:${userId}:${workspaceId}:${KEY}`}))`);
    const [existing] = await tx.select({ id: settings.id, value: settings.value }).from(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspaceId), eq(settings.key, KEY))).limit(1);
    const profile = updateProfile(isTypingProfile(existing?.value) ? existing!.value as TypingProfile : undefined, features);
    if (existing) await tx.update(settings).set({ value: profile, updatedAt: new Date() }).where(eq(settings.id, existing.id));
    else await tx.insert(settings).values({ userId, workspaceId, key: KEY, value: profile, category: "user" });
    return profile;
  });
}
