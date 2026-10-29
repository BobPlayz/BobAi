export type EmotionalSignal = "happy" | "excited" | "sad" | "curious" | "playful" | "frustrated" | "neutral";

export type ConversationMood = {
  signal: EmotionalSignal;
  intensity: number;
  context: string;
};

const SIGNALS: Array<{ signal: Exclude<EmotionalSignal, "neutral">; pattern: RegExp; context: string }> = [
  { signal: "frustrated", pattern: /\b(you suck|useless|stupid|idiot|shut up|fuck you|fucking|damn it|this is trash|you're dumb|you are dumb|this doesn't work|not working|broken|annoying)\b/i, context: "the user may be frustrated" },
  { signal: "sad", pattern: /\b(sad|upset|lonely|hurt|heartbroken|depressed|rough day|bad day|feeling down|miss them|miss him|miss her|i'm crying|im crying)\b/i, context: "the user may be feeling down" },
  { signal: "excited", pattern: /\b(lets go|let's go|so excited|can't wait|cant wait|amazing|incredible|won|we did it|this is awesome|hyped|finally)\b/i, context: "the conversation feels excited" },
  { signal: "curious", pattern: /\b(how does|how do|why does|why do|what if|i wonder|curious|tell me more|that's interesting|that is interesting)\b/i, context: "the user seems curious" },
  { signal: "playful", pattern: /\b(lol|lmao|rofl|jk|just kidding|bruh|bro what|no way|wild|thats crazy|that's crazy)\b/i, context: "the conversation feels playful" },
  { signal: "happy", pattern: /\b(thank you|thanks|thank u|ty|great|nice|love it|perfect|good job|you're helpful|you are helpful|happy|glad|worked|that helped)\b/i, context: "the conversation feels positive" },
];

export function getConversationMood(
  messages: Array<{ role?: unknown; content?: unknown }>,
): ConversationMood {
  const recent = messages
    .filter((message) => message?.role === "user" && typeof message.content === "string")
    .slice(-6)
    .map((message) => (message.content as string).slice(0, 2_000));

  const scores = new Map<EmotionalSignal, number>();
  for (const [index, message] of recent.entries()) {
    const recencyWeight = index >= recent.length - 2 ? 2 : 1;
    for (const item of SIGNALS) {
      if (item.pattern.test(message)) {
        scores.set(item.signal, (scores.get(item.signal) ?? 0) + recencyWeight);
        break;
      }
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [signal, score] = ranked[0] ?? ["neutral", 0];
  if (score <= 0) return { signal: "neutral", intensity: 0, context: "the recent conversation is neutral" };

  const context = SIGNALS.find((item) => item.signal === signal)?.context ?? "the conversation is neutral";
  return { signal, intensity: Math.min(3, score), context };
}

export function describeEmotionalContext(
  messages: Array<{ role?: unknown; content?: unknown }>,
): string {
  const mood = getConversationMood(messages);
  if (mood.signal === "neutral") return "neutral; keep a steady, natural tone";
  return mood.signal + " (intensity " + mood.intensity + "/3); " + mood.context;
}
