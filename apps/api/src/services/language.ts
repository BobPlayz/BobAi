/**
 * The language Jarvis replies in. The browser sends a language id from this list (never free text), so the prompt
 * can't be steered through this setting. Small models sometimes drift into another language (often Chinese), so the
 * rule is stated firmly and placed last in the system prompt, where models follow it best.
 */
export const LANGUAGES = {
  en: "English", hi: "Hindi", te: "Telugu", ta: "Tamil", kn: "Kannada", ml: "Malayalam", mr: "Marathi", bn: "Bengali",
  gu: "Gujarati", pa: "Punjabi", ur: "Urdu", es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese",
  ar: "Arabic", zh: "Chinese", ja: "Japanese", ko: "Korean", ru: "Russian", id: "Indonesian", tr: "Turkish", nl: "Dutch",
} as const;
export type LanguageId = keyof typeof LANGUAGES;

export function isLanguage(value: unknown): value is LanguageId {
  return typeof value === "string" && Object.hasOwn(LANGUAGES, value);
}

/** A language id from a request or setting; older free-text settings ("english") and anything unknown mean English. */
export function languageId(value: unknown): LanguageId {
  if (isLanguage(value)) return value;
  const byName = typeof value === "string" ? (Object.keys(LANGUAGES) as LanguageId[]).find((id) => LANGUAGES[id].toLowerCase() === value.trim().toLowerCase()) : undefined;
  return byName ?? "en";
}

export function languageRule(id: LanguageId) {
  const name = LANGUAGES[id];
  return `LANGUAGE RULE: always write your reply in ${name}, whatever language the sources, files, memories, earlier replies or your own habits are in. never switch to another language or mix in another script on your own. only answer in a different language when the user's latest message clearly asks for it (for example "say this in French" or "translate to Hindi"), and then only for that part. code, names and quoted text stay as they are.`;
}
