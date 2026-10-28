const DEFAULT_IMAGE_PROMPT = "a polished, high-quality digital illustration";

/** Deterministically route clear image-making requests instead of asking the language model to guess its capabilities. */
export function extractImagePrompt(text: string): string | null {
  const normalized = text.trim()
    .replace(/^(?:(?:hey|hi)[,!. ]+)?(?:(?:please|pls|plz)[,!. ]+)?(?:(?:can|could|would|will)\s+(?:you|u)\s+)?(?:(?:please|pls|plz)\s+)?/i, "");

  const explicit = normalized.match(/^(?:generate|create|make|draw|paint|render|design)\s+(?:(?:me|us)\s+)?(?:an?\s+)?(?:images?|pictures?|illustrations?|artworks?|drawings?|wallpapers?|logos?|posters?|photos?)\b(?:\s+(?:of|showing|depicting|with|for|about))?\s*([\s\S]*)$/i);
  if (explicit) {
    const prompt = explicit[1].trim().replace(/^[?.!,;:]+$/, "");
    return (prompt || DEFAULT_IMAGE_PROMPT).slice(0, 8_000);
  }

  const desired = normalized.match(/^i\s+(?:want|need|would like)\s+(?:an?\s+)?(?:images?|pictures?|illustrations?|artworks?|drawings?|wallpapers?|logos?|posters?|photos?)\s*(?:of|showing|depicting|with|for|about)?\s*([\s\S]*)$/i);
  if (desired) {
    const prompt = desired[1].trim().replace(/^[?.!,;:]+$/, "");
    return (prompt || DEFAULT_IMAGE_PROMPT).slice(0, 8_000);
  }

  const direct = normalized.match(/^(?:draw|paint)\s+(?:(?:me|us)\s+)?(?:(a|an|the)\s+)?([\s\S]+)$/i);
  return direct ? `${direct[1] ? `${direct[1]} ` : ""}${direct[2].trim()}`.slice(0, 8_000) || null : null;
}
