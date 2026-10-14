export function extractImagePrompt(text: string): string | null {
  const normalized = text.trim().replace(/^(?:hey[, ]+)?(?:can|could|would)\s+you\s+/i, "").replace(/^please\s+/i, "");
  const explicit = normalized.match(/^(?:generate|create|make|draw|paint|render)\s+(?:(?:me|us)\s+)?(?:an?\s+)?(?:image|picture|illustration|artwork|drawing|wallpaper|logo|poster|photo)\b(?:\s+(?:of|showing|depicting|with|for))?\s*([\s\S]*)$/i);
  if (explicit) {
    const prompt = explicit[1].trim();
    return (prompt || "a polished, high-quality digital illustration").slice(0, 8_000);
  }
  const desired = normalized.match(/^i\s+(?:want|need|would like)\s+(?:an?\s+)?(?:image|picture|illustration|artwork|drawing|wallpaper|logo|poster|photo)\s*(?:of|showing|depicting|with|for)?\s*([\s\S]*)$/i);
  if (desired) {
    const prompt = desired[1].trim();
    return (prompt || "a polished, high-quality digital illustration").slice(0, 8_000);
  }
  const direct = normalized.match(/^(?:draw|paint)\s+(?:(?:me|us)\s+)?(?:a|an|the)\s+([\s\S]+)$/i);
  return direct ? direct[1].trim().slice(0, 8_000) || null : null;
}
