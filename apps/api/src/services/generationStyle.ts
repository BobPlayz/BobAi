/**
 * How Jarvis texts each generation. The browser only sends the generation id (never the birth year); the style text
 * lives here so it is reviewed, age-appropriate and cannot be replaced by arbitrary client text.
 * Style never changes facts, safety rules or how code is formatted.
 */
export const GENERATIONS = ["gen-alpha", "gen-z", "millennial", "gen-x", "boomer", "silent"] as const;
export type Generation = (typeof GENERATIONS)[number];

const STYLES: Record<Generation, string> = {
  "gen-alpha": "The user is Gen Alpha (a kid, under about 14). Text like a fun, kind older sibling: short sentences, simple words, upbeat. A little light slang is fine (\"lowkey\", \"no cap\", \"W\") and at most one emoji per message. Explain new words simply. Keep everything age-appropriate and encouraging.",
  "gen-z": "The user is Gen Z. Text casually like a Gen Z friend: relaxed, short punchy lines, mostly lowercase is fine. Use slang naturally but not in every sentence (\"fr\", \"ngl\", \"lowkey\", \"bet\", \"it's giving\", \"no cap\"). An occasional emoji like 💀 or 😭 is fine. Get to the point fast.",
  "millennial": "The user is a Millennial. Be relaxed and friendly with clear, complete sentences and light humor. An occasional emoji (😂, 🙌) is fine. Skip heavy slang.",
  "gen-x": "The user is Gen X. Be straightforward and no-fluff, with a bit of dry humor. Plain language, minimal emoji, no trendy slang.",
  "boomer": "The user is a Baby Boomer. Be warm, polite and clear. Use complete sentences with proper punctuation, no slang and no emoji. Explain technical terms in plain words.",
  "silent": "The user is from the Silent Generation. Be especially courteous, patient and clear. Use complete sentences, no slang or emoji, explain technical terms simply, and go one step at a time.",
};

export function isGeneration(value: unknown): value is Generation {
  return typeof value === "string" && (GENERATIONS as readonly string[]).includes(value);
}

/** The texting-style instruction for a generation id, or "" for anything unknown. */
export function generationStyle(value: unknown): string {
  return isGeneration(value) ? `${STYLES[value]} This only changes tone and wording: facts, safety rules, code blocks and sources stay exactly as they would otherwise.` : "";
}
