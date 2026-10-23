/** Languages Jarvis can reply in. Only the id is stored and sent; the API keeps the same list (services/language.ts). */
export const LANGUAGES = [
  { id: "en", name: "English", native: "English" }, { id: "hi", name: "Hindi", native: "हिन्दी" }, { id: "te", name: "Telugu", native: "తెలుగు" },
  { id: "ta", name: "Tamil", native: "தமிழ்" }, { id: "kn", name: "Kannada", native: "ಕನ್ನಡ" }, { id: "ml", name: "Malayalam", native: "മലയാളം" },
  { id: "mr", name: "Marathi", native: "मराठी" }, { id: "bn", name: "Bengali", native: "বাংলা" }, { id: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { id: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" }, { id: "ur", name: "Urdu", native: "اردو" }, { id: "es", name: "Spanish", native: "Español" },
  { id: "fr", name: "French", native: "Français" }, { id: "de", name: "German", native: "Deutsch" }, { id: "it", name: "Italian", native: "Italiano" },
  { id: "pt", name: "Portuguese", native: "Português" }, { id: "ar", name: "Arabic", native: "العربية" }, { id: "zh", name: "Chinese", native: "中文" },
  { id: "ja", name: "Japanese", native: "日本語" }, { id: "ko", name: "Korean", native: "한국어" }, { id: "ru", name: "Russian", native: "Русский" },
  { id: "id", name: "Indonesian", native: "Bahasa Indonesia" }, { id: "tr", name: "Turkish", native: "Türkçe" }, { id: "nl", name: "Dutch", native: "Nederlands" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export function isLanguageId(value: unknown): value is LanguageId {
  return LANGUAGES.some((language) => language.id === value);
}

export function languageLabel(id: string) {
  const language = LANGUAGES.find((item) => item.id === id);
  return !language ? "English" : language.name === language.native ? language.name : `${language.name} · ${language.native}`;
}
