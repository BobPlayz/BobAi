const DEFAULT_IMAGE_PROMPT = "a polished, high-quality digital illustration";
const IMAGE_NOUN = "(?:images?|pictures?|illustrations?|artworks?|drawings?|wallpapers?|logos?|posters?|photos?)";

/** Route clear image-making requests directly to the image endpoint, without asking the chat model to infer capability. */
export function extractImagePrompt(text: string): string | null {
  const normalized = text.trim()
    .replace(/^(?:(?:hey|hi)[,!. ]+)?(?:(?:please|pls|plz)[,!. ]+)?(?:(?:can|could|would|will)\s+(?:you|u)\s+)?(?:(?:please|pls|plz)\s+)?/i, "")
    .trim();

  // Accept the common slash-command form, but treat it as a normal image-generation request.
  const imagine = normalized.match(/^\/imagine\s+([\s\S]+)$/i);
  if (imagine) {
    const prompt = imagine[1].trim().replace(/^[?.!,;:]+$/, "");
    return prompt ? prompt.slice(0, 8_000) : DEFAULT_IMAGE_PROMPT;
  }

  const explicit = normalized.match(new RegExp(
    String.raw`^(?:generate|create|make|draw|paint|render|design)\s+(?:(?:me|us)\s+)?(?:an?\s+)?${IMAGE_NOUN}\\b(?:\s+(?:of|showing|depicting|with|for|about))?\s*([\s\S]*)$`,
    "i",
  ));
  if (explicit) {
    const prompt = explicit[1].trim().replace(/^[?.!,;:]+$/, "");
    return (prompt || DEFAULT_IMAGE_PROMPT).slice(0, 8_000);
  }

  const desired = normalized.match(new RegExp(
    String.raw`^i\s+(?:want|need|would like)\s+(?:an?\s+)?${IMAGE_NOUN}\s*(?:of|showing|depicting|with|for|about)?\s*([\s\S]*)$`,
    "i",
  ));
  if (desired) {
    const prompt = desired[1].trim().replace(/^[?.!,;:]+$/, "");
    return (prompt || DEFAULT_IMAGE_PROMPT).slice(0, 8_000);
  }

  const direct = normalized.match(/^(?:draw|paint)\s+(?:(?:me|us)\s+)?(?:(a|an|the)\s+)?([\s\S]+)$/i);
  return direct ? `${direct[1] ? `${direct[1]} ` : ""}${direct[2].trim()}`.slice(0, 8_000) || null : null;
}
