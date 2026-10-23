/**
 * Pictures with answers (for visual learners): "ideas" questions get real pictures, "explain" questions get a simple
 * drawn picture. Decided from the question alone, so chit-chat and maths never trigger it.
 */
export type VisualKind = "ideas" | "explain";

const IDEAS = /\b(ideas?|designs?|examples?|inspiration|inspo|suggest(ions?)?|recommend|show me|pictures? of|photos? of|images? of|look like|types of|kinds of|styles? of|patterns?)\b/i;
const EXPLAIN = /\b(explain|how does|how do|how is|how are|what is|what are|why does|why do|why is|teach me|help me understand|diagram|parts of|life cycle|process of)\b/i;
const MATHS = /^[\s\d+\-*/^().=x?]+$|\b(solve|calculate|equation)\b/i;
const FILLER = new Set(["recommend", "suggest", "suggestions", "suggestion", "me", "some", "any", "good", "cool", "nice", "best", "ideas", "idea", "give", "show", "can", "could", "you", "u", "please", "pls", "plz", "i", "want", "need", "for", "a", "an", "the", "of", "to", "my", "on", "about", "explain", "how", "does", "do", "is", "are", "what", "why", "teach", "help", "understand", "tell", "inspiration", "inspo", "examples", "example", "pictures", "picture", "photos", "photo", "images", "image", "look", "like", "with", "and", "in", "simple", "simply", "easy", "way", "it", "works", "work"]);

export function visualKind(question: string): VisualKind | null {
  const text = question.trim();
  if (text.length < 8 || MATHS.test(text) || topicOf(text).split(" ").filter(Boolean).length === 0) return null;
  if (IDEAS.test(text)) return "ideas";
  if (EXPLAIN.test(text)) return "explain";
  return null;
}

/** The subject of a question: "recommend me muggulu ideas" -> "muggulu". */
export function topicOf(question: string) {
  return question.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((word) => word && !FILLER.has(word)).slice(0, 6).join(" ").trim();
}

export function explainPicturePrompt(topic: string) {
  return `simple friendly educational illustration that explains ${topic} for a student, clean flat colors, clear shapes, diagram style, white background, no text, no letters, no words`;
}

export function ideaPicturePrompt(topic: string) {
  return `beautiful example of ${topic}, clear, bright, high quality, no text`;
}
