export function extractImagePrompt(text: string): string | null {
  const normalized = text.trim();
  const explicit = normalized.match(/^(?:please\s+)?(?:generate|create|make|draw|paint|render)\s+(?:(?:me|us)\s+)?(?:an?\s+)?(?:image|picture|illustration|artwork|drawing|wallpaper|logo|poster|photo)\b(?:\s+(?:of|showing|depicting|with|for))?\s*([\s\S]*)$/i);
  if (explicit) {
    const prompt = explicit[1].trim();
    return (prompt || "a polished, high-quality digital illustration").slice(0, 8_000);
  }
  const direct = normalized.match(/^(?:please\s+)?(?:draw|paint)\s+(?:(?:me|us)\s+)?(?:a|an|the)\s+([\s\S]+)$/i);
  return direct ? direct[1].trim().slice(0, 8_000) || null : null;
}
