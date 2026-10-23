/** Generations by birth year. Only the generation id is stored and sent, never the year itself. */
export const GENERATIONS = [
  { id: "gen-alpha", label: "Gen Alpha", from: 2013, to: 9999, vibe: "short, fun and simple" },
  { id: "gen-z", label: "Gen Z", from: 1997, to: 2012, vibe: "casual with some slang, fr" },
  { id: "millennial", label: "Millennial", from: 1981, to: 1996, vibe: "relaxed and friendly" },
  { id: "gen-x", label: "Gen X", from: 1965, to: 1980, vibe: "straight to the point" },
  { id: "boomer", label: "Baby Boomer", from: 1946, to: 1964, vibe: "warm, clear, no slang" },
  { id: "silent", label: "Silent Generation", from: 1900, to: 1945, vibe: "patient and very clear" },
] as const;

export type GenerationId = (typeof GENERATIONS)[number]["id"];

export function generationForYear(year: number) {
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) return undefined;
  return GENERATIONS.find((generation) => year >= generation.from && year <= generation.to);
}

export function isGenerationId(value: unknown): value is GenerationId {
  return GENERATIONS.some((generation) => generation.id === value);
}
