import { totalmem } from "node:os";
import { ollamaEndpoint } from "./ollamaProvider.js";

/**
 * Model discovery for the configured Ollama endpoint.
 *
 * - Local Ollama / the Jarvis gateway: `/api/tags` lists models that are installed, so they can run here.
 * - Ollama Cloud: `/api/tags` is the public catalogue. Listed is not the same as usable on this account, so cloud
 *   models start as "listed" and the router learns which ones the account may use from real responses (403/404).
 *
 * Capabilities and context length come from the provider's own metadata (`capabilities`, `/api/show`), never from
 * model names. Results are cached briefly; a failed refresh keeps serving the last good list for a while.
 */
export type ModelInfo = {
  name: string;
  /** Capabilities reported by Ollama, e.g. completion, tools, thinking, vision, embedding. */
  capabilities: string[];
  capabilitiesKnown: boolean;
  contextLength?: number;
  parameterCount?: number;
  sizeBytes?: number;
  /** Local only: currently loaded in memory (faster first token). */
  loaded: boolean;
  /** True when the endpoint lists installed models (local/gateway); false for the public cloud catalogue. */
  installed: boolean;
};

export type Inventory = { models: ModelInfo[]; hosted: boolean; fetchedAt: number; error?: string; stale?: boolean };

const SHOW_TTL_MS = 6 * 60 * 60_000;
const STALE_LIMIT_MS = 60 * 60_000;
const SHOW_CONCURRENCY = 8;
/** Metadata still missing after this is filled in by a background refresh instead of delaying the first answer. */
const SHOW_WAIT_MS = 3_000;
const MAX_MODELS = 60;

const showCache = new Map<string, { at: number; info: Partial<ModelInfo> }>();
let cached: Inventory | undefined;
let inflight: Promise<Inventory> | undefined;

function inventoryTtlMs() {
  const value = Number(process.env.BOBAI_MODEL_INVENTORY_TTL_MS || 5 * 60_000);
  return Number.isFinite(value) ? Math.min(Math.max(value, 10_000), 60 * 60_000) : 5 * 60_000;
}

/** "2.2B" / "770M" / "32682372656" → a number of parameters, when the metadata provides one. */
export function parseParameterCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const match = /^([\d.]+)\s*([KMBT])?$/i.exec(value.trim());
  if (!match) return undefined;
  const scale = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(match[2] || "").toUpperCase() as "K" | "M" | "B" | "T"] ?? 1;
  const count = Number(match[1]) * scale;
  return Number.isFinite(count) && count > 0 ? count : undefined;
}

function contextLengthFrom(modelInfo: unknown): number | undefined {
  if (!modelInfo || typeof modelInfo !== "object") return undefined;
  for (const [key, value] of Object.entries(modelInfo as Record<string, unknown>)) {
    if (key.endsWith(".context_length") && typeof value === "number" && value > 0) return value;
  }
  return undefined;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status }); }
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) { await response.body?.cancel().catch(() => undefined); throw new Error("response was not JSON"); }
  return response.json();
}

async function show(base: string, name: string, headers: Record<string, string>): Promise<Partial<ModelInfo>> {
  const key = `${base}|${name}`;
  const hit = showCache.get(key);
  if (hit && Date.now() - hit.at < SHOW_TTL_MS) return hit.info;
  const data = await fetchJson(`${base}/api/show`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ model: name }) }, 5_000) as { capabilities?: unknown; model_info?: unknown; details?: { parameter_size?: unknown } };
  const info: Partial<ModelInfo> = {
    ...(Array.isArray(data.capabilities) ? { capabilities: data.capabilities.filter((item): item is string => typeof item === "string"), capabilitiesKnown: true } : {}),
    contextLength: contextLengthFrom(data.model_info),
    parameterCount: parseParameterCount(data.details?.parameter_size),
  };
  showCache.set(key, { at: Date.now(), info });
  return info;
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await fn(items[index]); }
  }));
  return results;
}

async function discover(): Promise<Inventory> {
  const { base, hosted, headers } = ollamaEndpoint();
  let tags: unknown;
  try { tags = await fetchJson(`${base}/api/tags`, { headers: headers() }, 6_000); }
  catch (error) {
    // ollama.com answers /api/tags with its HTML homepage when an Authorization header is sent; the catalogue
    // itself is public, so ask again without credentials.
    if (!hosted) throw error;
    tags = await fetchJson(`${base}/api/tags`, {}, 6_000);
  }
  const listed = Array.isArray((tags as { models?: unknown })?.models) ? (tags as { models: unknown[] }).models : [];
  let loaded = new Set<string>();
  if (!hosted) {
    try {
      const ps = await fetchJson(`${base}/api/ps`, { headers: headers() }, 2_000) as { models?: Array<{ name?: unknown; model?: unknown }> };
      loaded = new Set((ps.models ?? []).map((item) => String(item.name ?? item.model ?? "")).filter(Boolean));
    } catch { /* optional */ }
  }
  const listedModels = listed.slice(0, MAX_MODELS).flatMap((raw): ModelInfo[] => {
    const item = raw as { name?: unknown; model?: unknown; size?: unknown; capabilities?: unknown; details?: { parameter_size?: unknown } };
    const name = typeof item.name === "string" ? item.name : typeof item.model === "string" ? item.model : "";
    if (!name) return [];
    const capabilities = Array.isArray(item.capabilities) ? item.capabilities.filter((value): value is string => typeof value === "string") : [];
    return [{ name, capabilities, capabilitiesKnown: Array.isArray(item.capabilities), parameterCount: parseParameterCount(item.details?.parameter_size), sizeBytes: typeof item.size === "number" && item.size > 0 ? item.size : undefined, loaded: loaded.has(name), installed: !hosted }];
  });
  const authHeaders = hosted ? {} : headers();
  const enrich = (model: ModelInfo) => show(base, model.name, authHeaders)
    .then((extra) => ({ ...model, ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined)) } as ModelInfo))
    .catch(() => model);
  const enrichment = mapLimited(listedModels, SHOW_CONCURRENCY, enrich);
  const timedOut = Symbol("timeout");
  const raced = await Promise.race([enrichment, new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), SHOW_WAIT_MS).unref?.())]);
  let models: ModelInfo[];
  if (raced === timedOut) {
    // Use what the cache already has now; the finished lookups land in the show cache for the next refresh.
    models = listedModels.map((model) => { const hit = showCache.get(`${base}|${model.name}`); return hit ? { ...model, ...Object.fromEntries(Object.entries(hit.info).filter(([, value]) => value !== undefined)) } as ModelInfo : model; });
    void enrichment.then(() => { if (cached) cached = { ...cached, fetchedAt: 0 }; });
  } else models = raced;
  // Never route chat to embedding-only models, and skip local models that cannot fit in this machine's memory.
  const memoryLimit = totalmem() * 0.8;
  const usable = models.filter((model) => !(model.capabilitiesKnown && !model.capabilities.includes("completion")))
    .filter((model) => hosted || !model.sizeBytes || model.sizeBytes <= memoryLimit);
  return { models: usable, hosted, fetchedAt: Date.now() };
}

/** The current model list, refreshed when older than BOBAI_MODEL_INVENTORY_TTL_MS (default 5 minutes). */
export async function getInventory(options: { refresh?: boolean } = {}): Promise<Inventory> {
  if (cached && !options.refresh && !cached.stale && Date.now() - cached.fetchedAt < inventoryTtlMs()) return cached;
  if (inflight) return inflight;
  inflight = discover()
    .then((inventory) => { cached = inventory; return inventory; })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "model discovery failed";
      if (cached && Date.now() - cached.fetchedAt < STALE_LIMIT_MS) return { ...cached, stale: true, error: message };
      let hosted = false;
      try { hosted = ollamaEndpoint().hosted; } catch { /* not configured */ }
      return { models: [], hosted, fetchedAt: Date.now(), error: message };
    })
    .finally(() => { inflight = undefined; });
  return inflight;
}

/** Forget the cached list (after a model-not-found or access-denied answer). */
export function invalidateInventory() { cached = undefined; }

/** For tests. */
export function resetInventoryCache() { cached = undefined; inflight = undefined; showCache.clear(); }
