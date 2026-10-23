import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * "Build me a website on localhost": when Jarvis runs on your own computer, a website it writes is saved as a static
 * page in ~/JarvisSites/<name>/index.html and served by the API at http://localhost:<port>/sites/<name>/.
 * Only static HTML is saved and served (nothing is executed on the computer), and pages are served sandboxed so they
 * cannot reach Jarvis's sign-in cookies. Not available on a hosted deployment, where there is no localhost.
 */
export function localSitesEnabled() {
  return process.env.VERCEL !== "1" && process.env.BOBAI_LOCAL_SITES?.trim().toLowerCase() !== "false";
}

export function sitesDirectory() {
  return path.resolve(process.env.BOBAI_SITES_DIR?.trim() || path.join(homedir(), "JarvisSites"));
}

/** Did the user ask for something to run on localhost? */
export function wantsLocalSite(text: string) {
  return /\b(localhost|local\s?host|run (?:it )?locally|host (?:it )?locally)\b/i.test(text);
}

/** The first complete HTML document in a reply (a ```html block, or a raw document). */
export function extractHtml(reply: string) {
  const block = /```html\s*\n([\s\S]*?)```/i.exec(reply)?.[1] ?? (/```\s*\n(\s*(?:<!doctype html|<html)[\s\S]*?)```/i.exec(reply)?.[1]);
  const html = (block ?? (/^\s*(?:<!doctype html|<html)/i.test(reply) ? reply : "")).trim();
  return /<html[\s>]|<!doctype html/i.test(html) && html.length <= 500_000 ? html : "";
}

/** A short, safe folder name from the user's request ("simple calculator website" -> "calculator"). */
export function siteName(request: string) {
  const words = request.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
    .filter((word) => word && !["build", "make", "create", "me", "a", "an", "the", "simple", "basic", "website", "site", "web", "page", "app", "on", "in", "at", "localhost", "local", "host", "please", "pls", "for", "my", "and", "with", "run", "it", "locally"].includes(word));
  return (words.slice(0, 3).join("-") || "site").slice(0, 40).replace(/^-+|-+$/g, "") || "site";
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,47}$/;

/** Saves the page under a free name (calculator, calculator-2, ...) and returns its local address. */
export async function saveLocalSite(html: string, request: string, port: number) {
  const base = siteName(request);
  const root = sitesDirectory();
  await mkdir(root, { recursive: true });
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const folder = path.join(root, slug);
    try { await mkdir(folder); } catch { continue; }
    await writeFile(path.join(folder, "index.html"), html, "utf8");
    return { slug, url: `http://localhost:${port}/sites/${slug}/`, folder };
  }
  throw new Error("could not find a free folder name for the site");
}

/** Reads a saved page; refuses anything that is not a plain site name. */
export async function readLocalSite(slug: string) {
  if (!SLUG.test(slug)) return null;
  const file = path.join(sitesDirectory(), slug, "index.html");
  if (path.dirname(path.dirname(file)) !== sitesDirectory()) return null;
  try { return await readFile(file, "utf8"); } catch { return null; }
}
