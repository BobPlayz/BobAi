// Only explicit, imperative memory commands are treated as "save this" requests. Ordinary statements
// ("I love Python, how do decorators work?") and recall questions ("do you remember my name?") must reach
// the model and get a real answer instead of being swallowed by the memory short-circuit.
const MEMORY_COMMAND = /^\s*(?:(?:hey\s+)?jarvis[,:]?\s+)?(?:please\s+)?(?:remember|don['’]?t forget|do not forget|note that|(?:save|store|add)\s+(?:this\s+|that\s+)?(?:to|in)\s+(?:your\s+)?memory)(?:\s+that)?\s*[:,-]?\s+\S/i;

export function extractMemory(text: string): boolean {
  if (typeof text !== "string") return false;
  const value = text.trim();
  if (!value || value.length > 2_000 || value.endsWith("?")) return false;
  return MEMORY_COMMAND.test(value);
}
