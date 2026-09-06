import { webSearch, type ResearchSource } from "./research.js";

const MAX_SUBQUERIES = 6;
const MAX_SOURCES = 24;
const MAX_SOURCE_TEXT = 12_000;
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

function makeSubqueries(query: string): string[] {
  return [
    query,
    `${query} key facts evidence",
    `${query} latest developments",
    `${query} competing perspectives",
  ].slice(0, MAX_SUBQUERIES);
}

function dedupeSources(sourceLists: ResearchSource[][]): ResearchSource[] {
  const seen = new Set<string>();
  const output: ResearchSource[] = [];
  for (const source of sourceLists.flat()) {
    try {
      const canonical = new URL(source.url);
      canonical.hash = "";
      const key = canonical.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push({ ...source, url: key });
    } catch {
      continue;
    }
    if (output.length >= MAX_SOURCES) break;
  }
  return output;
}

async function fetchEvidence(source: ResearchSource): Promise<{ url: string; title: string; excerpt: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(source.url, { signal: controller.signal, redirect: "error" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
    const text = (await response.text()).replace(/\s+/g, " ").trim();
    if (!text) return null;
    return { url: source.url, title: source.title, excerpt: text.slice(0, MAX_SOURCE_TEXT) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildSynthesis(query: string, evidence: Array<{ url: string; title: string; excerpt: string }>): string {
  if (!evidence.length) return `Research completed for "${query}", but the configured search provider did not expose readable source text. Use the returned source links for verification.`;
  const lines = evidence.slice(0, 10).map((item, index) => `${index + 1}. ${item.title}\n${item.excerpt.slice(0, 900)}\nSource: ${item.url}`);
  return `Research brief for: ${query}\n\n${lines.join("\n\n")}`;
}

export async function deepResearch(input: unknown): Promise<DeepResearchResult> {
  const query = cleanQuery(input);
  const results = await Promise.all(makeSubqueries(query).map((subquery) => webSearch(subquery)));
  const sources = dedupeSources(results.map((result) => result.sources));
  const evidence = (await Promise.all(sources.slice(0, 12).map(fetchEvidence))).filter(Boolean) as Array<{ url: string; title: string; excerpt: string }>;
  return { query, sources, evidence, synthesis: buildSynthesis(query, evidence) };
}
