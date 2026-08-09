import { remember } from "../memory/memory.js";

export function extractMemory(text: string) {
  const t = text.toLowerCase().trim();

  let m = t.match(/^remember my favorite (.+?) is (.+)$/);
  if (m) {
    remember(`favorite ${m[1]}`, m[2]);
    return true;
  }

  m = t.match(/^remember my (.+?) is (.+)$/);
  if (m) {
    remember(m[1], m[2]);
    return true;
  }

  m = t.match(/^remember that i (.+)$/);
  if (m) {
    remember("user fact", m[1]);
    return true;
  }

  return false;
}