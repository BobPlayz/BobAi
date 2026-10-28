const DEFAULT_IMAGE_PROMPT = "a polished, high-quality digital illustration";
const IMAGE_NOUN = "(?:images?|pictures?|illustrations?|artworks?|drawings?|wallpapers?|logos?|posters?|photos?)";
const IMAGE_WORDS = ["generate", "create", "make", "draw", "paint", "render", "design", "image", "images", "picture", "pictures", "illustration", "illustrations", "artwork", "drawing", "wallpaper", "logo", "poster", "photo"];
const COMMON_PROMPT_TYPO: Record<string, string> = {
  teh: "the", thier: "their", adn: "and", waht: "what", wih: "with", fom: "from",
  imge: "image", imges: "images", imag: "image", pictur: "picture", picure: "picture",
  genrate: "generate", generat: "generate", gnerate: "generate", cretae: "create",
  craete: "create", mak: "make", drw: "draw", desgin: "design", illustation: "illustration",
  robt: "robot", robit: "robot", roboot: "robot", skyy: "sky", spcae: "space",
  cattt: "cat", dogg: "dog", flover: "flower", tre: "tree", mounain: "mountain",
};

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

function normalizeImageWords(text: string): string {
  let position = 0;
  return text.replace(/[A-Za-z]+/g, (word) => {
    const wordPosition = position++;
    const lower = word.toLowerCase();
    if (COMMON_PROMPT_TYPO[lower]) return COMMON_PROMPT_TYPO[lower];
    // Fuzzy-match command words only near the start, never arbitrary words/names in the subject.
    if (wordPosition > 3) return word;
    const candidate = IMAGE_WORDS.find((known) => {
      const limit = lower.length >= 8 ? 2 : lower.length >= 5 ? 1 : 0;
      return limit > 0 && Math.abs(known.length - lower.length) <= limit && editDistance(lower, known) <= limit;
    });
    return candidate ?? word;
  });
}

/** Route clear image-making requests directly to the image endpoint, tolerating common typos. */
export function extractImagePrompt(text: string): string | null {
  const corrected = normalizeImageWords(text.trim());
  const normalized = corrected
    // Ignore casual openers so "yo, generate an image of a robot" still routes to the image tool.
    .replace(/^(?:(?:hey|hi|yo|sup)[,!. ]+)?(?:(?:jarvis)[,!. ]+)?(?:(?:please|pls|plz)[,!. ]+)?(?:(?:can|could|would|will)\s+(?:you|u)\s+)?(?:(?:please|pls|plz)\s+)?/i, "")
    .trim();

  const imagine = normalized.match(/^\/?(?:imagine|imagne|imagien)\s+([\s\S]+)$/i);
  if (imagine) {
    const prompt = imagine[1].trim().replace(/^[?.!,;:]+$/, "");
    return prompt ? prompt.slice(0, 8_000) : DEFAULT_IMAGE_PROMPT;
  }

  const explicit = normalized.match(new RegExp(
    String.raw`^(?:generate|create|make|draw|paint|render|design)\s+(?:(?:me|us)\s+)?(?:an?\s+)?${IMAGE_NOUN}\b(?:\s+(?:of|showing|depicting|with|for|about))?\s*([\s\S]*)$`,
    "i",
  ));
  if (explicit) {
    const prompt = explicit[1].trim().replace(/^[?.!,;:]+$/, "");
    return (prompt || DEFAULT_IMAGE_PROMPT).slice(0, 8_000);
  }

  const desired = normalized.match(new RegExp(
    String.raw`^i\s+(?:want|need|would like|woud like)\s+(?:an?\s+)?${IMAGE_NOUN}\s*(?:of|showing|depicting|with|for|about)?\s*([\s\S]*)$`,
    "i",
  ));
  if (desired) {
    const prompt = desired[1].trim().replace(/^[?.!,;:]+$/, "");
    return (prompt || DEFAULT_IMAGE_PROMPT).slice(0, 8_000);
  }

  const direct = normalized.match(/^(?:draw|paint)\s+(?:(?:me|us)\s+)?(?:(a|an|the)\s+)?([\s\S]+)$/i);
  return direct ? `${direct[1] ? `${direct[1]} ` : ""}${direct[2].trim()}`.slice(0, 8_000) || null : null;
}
