export function wantsImage(text: string): boolean {
  const lower = text.toLowerCase();

  return [
    "draw",
    "generate an image",
    "generate a picture",
    "create an image",
    "make me a",
    "make a wallpaper",
    "wallpaper",
    "logo",
    "illustration",
    "artwork",
    "render",
    "poster",
    "portrait",
    "anime style",
    "photo of",
    "concept art",
    "cyberpunk",
    "character design",
    "avatar",
    "background",
    "wallpaper for",
  ].some((k) => lower.includes(k));
}