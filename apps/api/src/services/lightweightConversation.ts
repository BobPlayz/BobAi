/**
 * Avoid expensive vector-memory and document retrieval for obvious small talk.
 * Questions and substantive requests still use the full context pipeline.
 */
export function isLightweightConversation(text: string): boolean {
  const value = text.trim().toLowerCase().replace(/[.!…]+$/g, "").replace(/\s+/g, " ");
  if (!value || value.length > 100 || /[?¿]|\b(why|how|what|when|where|who|which|explain|search|research|code|build|write|make|create|help|remember|recall|find|compare|analyze|analyse|summarize|summarise|translate|calculate|solve|generate|latest|current|look up)\b/i.test(value)) return false;
  return /^(hi|hello|hey|heya|yo|sup|what'?s up|how are you|how'?s it going|good morning|good afternoon|good evening|good night|thanks|thank you|thx|ty|welcome|you'?re welcome|okay|ok|k|alright|sure|got it|understood|cool|nice|great|awesome|lol|lmao|haha+|hehe+|bruh|bro|fr|same|true|fair|yep|yeah|yes|no|nope|nah|bye|goodbye|see ya|see you|gn|wyd|idk|ikr|of course|my bad|sorry|all good|not much|nothing much|just chilling|just chillin|chilling|chillin|i'?m good|im good|doing good|fine|pretty good|not bad|and you|you too|exactly|real|facts|bet|valid|wild|crazy|nice to meet you|pleasure to meet you|good bot|good boy|good girl|thank you jarvis|thanks jarvis)$/i.test(value);
}
