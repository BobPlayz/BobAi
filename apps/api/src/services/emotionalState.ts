export type EmotionalSignal = "positive" | "frustrated" | "neutral";

export type ConversationMood = {
  signal: EmotionalSignal;
  intensity: number;
  context: string;
};

const POSITIVE = /\b(thank you|thanks|thank u|ty|great|awesome|nice|love it|perfect|good job|you're helpful|you are helpful)\b/i;
const FRUSTRATED = /\b(you suck|useless|stupid|idiot|shut up|fuck you|fucking|damn it|this is trash|you're dumb|you are dumb)\b/i;

/**
 * Derive a lightweight, temporary conversational tone from recent user turns.
 * This is a style signal, not a claim that the model experiences emotions.
 * No mood is persisted or used to deny otherwise-allowed assistance.
 */
export function getConversationMood(
  messages: Array<{ role?: unknown; content?: unknown }>,
): ConversationMood {
  const recent = messages
    .filter((message) => message?.role === "user" && typeof message.content === "string")
    .slice(-6)
    .map((message) => (message.content as string).slice(0, 2_000));

  let score = 0;
  for (const message of recent) {
    if (FRUSTRATED.test(message)) score -= 2;
    else if (POSITIVE.test(message)) score += 1;
  }

  if (score <= -2) {
    return {
      signal: "frustrated",
      intensity: Math.min(3, Math.abs(score)),
      context: "the recent conversation has been tense",
    };
  }
  if (score >= 1) {
    return {
      signal: "positive",
      intensity: Math.min(3, score),
      context: "the recent conversation has been friendly",
    };
  }
  return { signal: "neutral", intensity: 0, context: "the recent conversation is neutral" };
}

export function describeEmotionalContext(
  messages: Array<{ role?: unknown; content?: unknown }>,
): string {
  const mood = getConversationMood(messages);
  if (mood.signal === "frustrated") {
    return `mildly tense (intensity ${mood.intensity}/3); ${mood.context}`;
  }
  if (mood.signal === "positive") {
    return `friendly (intensity ${mood.intensity}/3); ${mood.context}`;
  }
  return "neutral; keep a steady, natural tone";
}
