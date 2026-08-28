const MEMORY_PATTERNS = [
  /\bremember\b/i,
  /\bdon['’]?t forget\b/i,
  /\bmy (?:name|preference|favorite|favou?rite)\b/i,
  /\bi (?:like|love|prefer|hate|dislike)\b/i,
];

export function extractMemory(text: string): boolean {
  return typeof text === "string" && MEMORY_PATTERNS.some((pattern) => pattern.test(text));
}
