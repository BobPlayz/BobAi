import { assertMediaPromptSafe } from "./mediaSafety.js";

/**
 * Real pictures for "ideas" questions ("muggulu ideas", "cake designs"), from Wikimedia Commons: free, no key, and
 * every picture is openly licensed with its author credited. Commons has no adult-content filter of its own, so
 * queries pass Jarvis's media safety screen and results whose titles or descriptions mention adult content are dropped.
 */
export type FoundPicture = { thumb: string; title: string; page: string; credit: string; license: string };

const API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "JarvisAssistant/1.0 (https://jarvis-x-ai-two.vercel.app; school project)";
const ADULT = /\b(nude|nudity|naked|nsfw|erotic|porn|sex|sexual|topless|lingerie|bikini|breast|genital|explicit|fetish|gore|corpse|dead body)\b/i;
const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;
const cache = new Map<string, { at: number; pictures: FoundPicture[] }>();
const CACHE_MS = 10 * 60_000;

const plain = (html: unknown) => typeof html === "string" ? html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

export async function searchPictures(query: string, limit = 6, signal?: AbortSignal): Promise<FoundPicture[]> {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!q) return [];
  assertMediaPromptSafe(q);
  if (ADULT.test(q)) return [];
  const key = `${q.toLowerCase()}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.pictures;
  const url = new URL(API);
  for (const [name, value] of Object.entries({ action: "query", format: "json", generator: "search", gsrsearch: `${q} filetype:bitmap`, gsrnamespace: "6", gsrlimit: String(Math.min(20, limit * 3)), prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: "480", iiextmetadatafilter: "Artist|LicenseShortName|ImageDescription|ObjectName", origin: "*" })) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, accept: "application/json" }, redirect: "error", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`picture search returned HTTP ${response.status}`);
  const data = await response.json() as { query?: { pages?: Record<string, { index?: number; title?: string; imageinfo?: Array<{ thumburl?: string; descriptionurl?: string; mime?: string; extmetadata?: Record<string, { value?: unknown }> }> }> } };
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const pictures: FoundPicture[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const title = (plain(meta.ObjectName?.value) || (page.title ?? "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "")).slice(0, 100);
    const description = plain(meta.ImageDescription?.value);
    if (!info?.thumburl || !info.descriptionurl || !IMAGE_MIME.test(info.mime ?? "")) continue;
    if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(info.thumburl) || !/^https:\/\/commons\.wikimedia\.org\//.test(info.descriptionurl)) continue;
    if (ADULT.test(`${title} ${description} ${page.title ?? ""}`)) continue;
    pictures.push({ thumb: info.thumburl, title, page: info.descriptionurl, credit: plain(meta.Artist?.value).slice(0, 80) || "Wikimedia Commons", license: plain(meta.LicenseShortName?.value).slice(0, 40) || "see source" });
    if (pictures.length >= limit) break;
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), pictures });
  return pictures;
}
