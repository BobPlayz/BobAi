/** Optional educational visuals for users who explicitly ask Jarvis to explain a topic. */
export type VisualKind = "explain";

const EXPLAIN = /\b(?:please\s+)?(?:explain|teach me|help me understand|walk me through|break down)\b/i;
const MATHS = /^[\s\d+\-*/^().=x?]+$|\b(solve|calculate|equation)\b/i;
const SOCIAL_CHAT = /^(?:(?:hello|hi|hey|yo|sup)[,!?. ]+)?(?:jarvis[,!?. ]+)?(?:(?:what'?s up|how are you(?: doing)?|how'?s it going|how have you been|what are you up to|you there|are you there)[^?!.]{0,30}[?!. ]*)+$/i;
const FILLER = new Set(["recommend", "suggest", "suggestions", "suggestion", "me", "some", "any", "good", "cool", "nice", "best", "ideas", "idea", "give", "show", "can", "could", "you", "u", "please", "pls", "plz", "i", "want", "need", "for", "a", "an", "the", "of", "to", "my", "on", "about", "explain", "how", "does", "do", "is", "are", "what", "why", "teach", "help", "understand", "tell", "inspiration", "inspo", "examples", "example", "pictures", "picture", "photos", "photo", "images", "image", "look", "like", "with", "and", "in", "simple", "simply", "easy", "way", "it", "works", "work"]);

export function visualKind(question: string): VisualKind | null {
  const text = question.trim();
  // Visuals are an opt-in learning aid, not decoration: only an explicit request to explain a topic qualifies.
  if (text.length < 8 || SOCIAL_CHAT.test(text) || MATHS.test(text) || !EXPLAIN.test(text)) return null;
  const topic = topicOf(text);
  if (!topic || topic.split(" ").filter(Boolean).length === 0) return null;
  return "explain";
}

/** The subject of a question: "recommend me muggulu ideas" -> "muggulu". */
export function topicOf(question: string) {
  return question.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((word) => word && !FILLER.has(word)).slice(0, 6).join(" ").trim();
}

export function explainPicturePrompt(topic: string) {
  return `simple friendly educational illustration that explains ${topic} for a student, clean flat colors, clear shapes, diagram style, white background, no text, no letters, no words`;
}

