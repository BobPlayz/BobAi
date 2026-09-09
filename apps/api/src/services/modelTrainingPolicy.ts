export type TrainingConsent = { optIn: boolean; scope?: "preferences-and-conversations" };
export type TrainingMessage = { role: "user" | "assistant"; content: string };
const SECRET_PATTERNS = [/bearer\s+[a-z0-9._-]{20,}/gi, /(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*\S+/gi, /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/gi];
const PII_PATTERNS = [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, /\b(?:\+?\d[\d ()-]{7,}\d)\b/g];
export function trainingOptedIn(value: unknown): boolean { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const consent = value as Partial<TrainingConsent>; return consent.optIn === true && (consent.scope === undefined || consent.scope === "preferences-and-conversations"); }
export function sanitizeTrainingText(input: string): string { let output = input; for (const pattern of SECRET_PATTERNS) output = output.replace(pattern, "[REDACTED]"); for (const pattern of PII_PATTERNS) output = output.replace(pattern, "[PRIVATE]"); return output.trim(); }
export function buildTrainingExample(messages: TrainingMessage[], userPreferences: Record<string, unknown> = {}, eligibleForTraining = true): { messages: TrainingMessage[]; preferences: Record<string, unknown> } | null {
  if (!eligibleForTraining || !messages.length) return null;
  const sanitized = messages.map((message) => ({ role: message.role, content: sanitizeTrainingText(message.content).slice(0, 50_000) })).filter((message) => message.content.length > 0);
  if (!sanitized.some((message) => message.role === "user") || !sanitized.some((message) => message.role === "assistant")) return null;
  const safePreferences: Record<string, unknown> = {};
  for (const key of ["language", "responseStyle", "personality", "theme"]) { const value = userPreferences[key]; if (typeof value === "string") safePreferences[key] = value.slice(0, 5_000); }
  return { messages: sanitized, preferences: safePreferences };
}
