import { webSearch, type ResearchSource } from "./research.js";
import { runChat } from "./chatEngine.js";

const MAX_SUBQUERIES = 6;
const MAX_SOURCES = 24;
const MAX_SOURCE_TEXT = 12_000;
const MAX_SYNTHESIS_INPUT = 90_000;
const DEFAULT_TIMEOUT_MS = 45_000;

export type DeepResearchResult = {
  query: string;
  sources: ResearchSource[];
  evidence: Array<{ url: string; title: string; excerpt: string }>;
  synthesis: string;
};

function cleanQuery(value: unknown): string {
  const query = typeof value === "string" ? value.trim() : "";
  if (!query) throw new Error("research query is required");
  if (query.length > 2_000) throw new Error("research query is too long");
  return query;
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/[\[\]]/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1" || host === "0.0.0.0") return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
}

function safeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || isPrivateHostname(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function makeSubqueries(query: string): string[] {
  return [query, `${query} key facts evidence`, `${query} latest developments`, `${query} competing perspectives`].slice(0, MAX_SUBQUERIES);
}

function dedupeSources(sourceLists: ResearchSource[][]): ResearchSource[] {
  const seen = new Set<string>();
  const output: ResearchSource[] = [];
  for (const source of sourceLists.flat()) {
    const parsed = safeSourceUrl(source.url);
    if (!parsed) continue;
    parsed.hash = "";
    const key = parsed.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ ...source, url: key });
    if (output.length >= MAX_SOURCES) break;
  }
  return output;
}

async function fetchEvidence(source: ResearchSource): Promise<{ url: string; title: string; excerpt: string } | null> {
  const safeUrl = safeSourceUrl(source.url);
  if (!safeUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(safeUrl, { signal: controller.signal, redirect: "error" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
    const text = (await response.text()).replace(/\s+/g, " ").trim();
    if (!text) return null;
    return { url: safeUrl.toString(), title: source.title, excerpt: text.slice(0, MAX_SOURCE_TEXT) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function synthesize(query: string, evidence: Array<{ url: string; title: string; excerpt: string }>): Promise<string> {
  if (!evidence.length) return `Research completed for "${query}", but the configured search provider did not expose readable source text. Use the returned source links for verification.`;
  const material = evidence.map((item, index) => `[${index + 1}] ${item.title}\nURL: ${item.url}\n${item.excerpt.slice(0, 7_000)}`).join("\n\n").slice(0, MAX_SYNTHESIS_INPUT);
  try {
    const response = await runChat([
      { role: "system", content: "You are BobAI's research synthesizer. Produce a concise, accurate research report from the supplied source material. Separate established facts from uncertainty or disagreement. Never invent citations or facts. Cite claims inline using [1], [2], etc., matching the supplied source numbers. End with a short Sources section listing only the source numbers actually used. Use headings and useful bullet points where appropriate." },
      { role: "user", content: `Research question: ${query}\n\nSource material:\n${material}` },
    ]);
    const content = response.message?.content?.trim();
    if (content) return content;
  } catch {}
  return evidence.slice(0, 10).map((item, index) => `[${index + 1}] ${item.title}\n${item.excerpt.slice(0, 900)}\nSource: ${item.url}`).join("\n\n");
}

export async function deepResearch(input: unknown): Promise<DeepResearchResult> {
  const query = cleanQuery(input);
  const results = await Promise.all(makeSubqueries(query).map((subquery) => webSearch(subquery)));
  const sources = dedupeSources(results.map((result) => result.sources));
  const evidence = (await Promise.all(sources.slice(0, 12).map(fetchEvidence))).filter(Boolean) as Array<{ url: string; title: string; excerpt: string }>;
  return { query, sources, evidence, synthesis: await synthesize(query, evidence) };
}
