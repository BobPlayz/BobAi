import { getInventory, invalidateInventory, type Inventory, type ModelInfo } from "./modelInventory.js";
import { getHealth, isCoolingDown, isDenied, recordFailure, recordSuccess, reliability } from "./modelHealth.js";
import { ModelUnavailableError, ollamaChat, ollamaPredictTokens, ollamaStatus, ollamaStream, ollamaVision, preferredModel, type ModelProblem, type FinishReason } from "./ollamaProvider.js";
import type { NativeMessage } from "./nativeModel.js";

/**
 * Automatic model routing over whatever the configured Ollama endpoint offers.
 *
 * 1. Work out the task (chat, coding, reasoning, vision, tool decision) from the request.
 * 2. Keep only models whose reported capabilities and context length fit, that are not denied to this account or
 *    cooling down after a failure.
 * 3. Rank by measured reliability and speed, plus metadata signals (thinking support and size for hard tasks,
 *    small size for simple ones, tool support for tool decisions). Model names are never used for ranking.
 * 4. Try the best one; on a retryable failure before any text was produced, try the next, within a strict attempt
 *    and time budget. Authentication and connection failures stop immediately (another model would not help).
 */
export type RouteTask = "chat" | "coding" | "reasoning" | "vision" | "tool_decision";
export type RouteStrategy = "auto" | "fastest" | "strongest" | "fixed";
export type RouteOptions = { task?: RouteTask; preferredModel?: string; signal?: AbortSignal };
export type RouteResult = { content: string; model: string; fallbacks: number; finishReason?: FinishReason };
export type RankedModel = { name: string; score: number; reasons: string[] };

const NON_RETRYABLE: ModelProblem[] = ["auth", "not_configured", "unreachable", "no_model"];

function strategy(): RouteStrategy {
  const value = process.env.BOBAI_MODEL_ROUTING?.trim().toLowerCase();
  return value === "fastest" || value === "strongest" || value === "fixed" ? value : "auto";
}
function numberEnv(key: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.max(value, min), max) : fallback;
}
const maxAttempts = () => numberEnv("BOBAI_MODEL_MAX_ATTEMPTS", 3, 1, 6);
const routeBudgetMs = () => numberEnv("BOBAI_MODEL_ROUTE_BUDGET_MS", 150_000, 5_000, 600_000);
const firstTokenTimeoutMs = (hosted: boolean) => numberEnv("BOBAI_MODEL_FIRST_TOKEN_TIMEOUT_MS", hosted ? 45_000 : 120_000, 2_000, 300_000);

const CODING = /\b(code|coding|debug|refactor|typescript|javascript|python|java|rust|golang|react|next\.js|css|html|sql|regex|api|endpoint|function|component|script|compiler|stack trace|exception|bug)\b|\b(write|build|implement|fix)\b.{0,40}\b(app|website|program|bot|api|script|function|component|tool|game)\b|```/i;
const REASONING = /\b(prove|proof|step[- ]by[- ]step|derive|calculate|solve|explain why|compare|analy[sz]e|trade-?offs?|plan|strategy|design|optimi[sz]e|essay|evaluate|pros and cons)\b/i;

/** Task from the latest user message. Long or analytical requests count as reasoning. */
export function classifyTask(messages: NativeMessage[], hint?: RouteTask): RouteTask {
  if (hint) return hint;
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  if (CODING.test(latest)) return "coding";
  if (REASONING.test(latest) || latest.length > 1_500) return "reasoning";
  return "chat";
}

/** ~3 characters per token (conservative for English and code), plus room for the reply. */
export function requiredContextTokens(messages: NativeMessage[]) {
  const characters = messages.reduce((sum, message) => sum + message.content.length, 0);
  return Math.ceil(characters / 3) + ollamaPredictTokens();
}

function preferenceFor(task: RouteTask) {
  return preferredModel(task === "coding" ? "coding" : task === "vision" ? "vision" : "chat");
}

/** Ordered candidates for a task. Exported for the readiness report and tests. */
export function rankModels(inventory: Inventory, task: RouteTask, options: { requiredTokens?: number; preferredModel?: string; now?: number } = {}): RankedModel[] {
  const now = options.now ?? Date.now();
  const mode = strategy();
  const complex = task === "coding" || task === "reasoning";
  const configuredPreference = preferenceFor(task);
  // A model without a reported size is treated as typical for this endpoint, neither small nor large.
  const knownSizes = inventory.models.map((model) => model.parameterCount).filter((value): value is number => Boolean(value)).sort((a, b) => a - b);
  const typicalSize = knownSizes.length ? knownSizes[Math.floor(knownSizes.length / 2)] : undefined;
  const ranked: RankedModel[] = [];
  for (const model of inventory.models) {
    const reasons: string[] = [];
    const health = getHealth(model.name);
    if (isDenied(model.name, now)) continue;
    // Capabilities must be reported by Ollama (or proven by a successful answer) before a model is used.
    if (!model.capabilitiesKnown && !health?.verified) continue;
    if (model.capabilitiesKnown && !model.capabilities.includes("completion")) continue;
    if (task === "vision" && !model.capabilities.includes("vision")) continue;
    if (options.requiredTokens && model.contextLength && model.contextLength < options.requiredTokens) continue;

    let score = 40 * reliability(model.name);
    if (health?.firstTokenMs !== undefined) {
      const seconds = health.firstTokenMs / 1000;
      const weight = mode === "fastest" ? 3 : mode === "strongest" ? 0.25 : complex ? 0.5 : 1.5;
      score -= Math.min(seconds, 40) * weight;
      reasons.push(`first token ~${Math.round(health.firstTokenMs)} ms`);
    }
    if (health?.verified) { score += 6; reasons.push("answered before"); }
    const parameters = model.parameterCount ?? typicalSize;
    const billions = parameters ? parameters / 1e9 : undefined;
    if (billions) {
      const sizeSignal = Math.min(Math.log2(Math.max(billions, 0.5)), 9);
      const wantStrong = mode === "strongest" || (mode === "auto" && complex);
      score += wantStrong ? sizeSignal * 3 : -sizeSignal * 1.5;
      reasons.push(model.parameterCount ? `${billions.toFixed(1)}B parameters` : "size not reported");
    }
    if (model.capabilities.includes("thinking") && complex) { score += 4; reasons.push("supports thinking"); }
    if (model.capabilities.includes("tools") && task === "tool_decision") { score += 5; reasons.push("supports tools"); }
    if (model.loaded) { score += 5; reasons.push("already loaded"); }
    if (!model.contextLength) score -= 3;
    if (isCoolingDown(model.name, now)) { score -= 100; reasons.push("cooling down after a failure"); }
    if (configuredPreference === model.name) { score += 50; reasons.push("preferred in settings"); }
    if (options.preferredModel === model.name) { score += 1_000; reasons.push("chosen by the user"); }
    ranked.push({ name: model.name, score, reasons });
  }
  ranked.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  // Tool decisions go to models that report tool support first; the rest stay as fallbacks.
  if (task === "tool_decision") {
    const toolCapable = new Set(inventory.models.filter((model) => model.capabilities.includes("tools")).map((model) => model.name));
    return [...ranked.filter((item) => toolCapable.has(item.name)), ...ranked.filter((item) => !toolCapable.has(item.name))];
  }
  return ranked;
}

// A healthy provider check is reused for a minute so routing does not add a network round trip to every message.
let providerCache: { at: number; status: Awaited<ReturnType<typeof ollamaStatus>> } | undefined;
async function providerStatus() {
  if (providerCache && Date.now() - providerCache.at < 60_000) return providerCache.status;
  const status = await ollamaStatus();
  providerCache = status.ready ? { at: Date.now(), status } : undefined;
  return status;
}
/** For tests. */
export function resetProviderCache() { providerCache = undefined; }

/** "bob" (or nothing) means automatic routing, "bob-coder" routes as a coding task, anything else is an explicit model. */
export function routingChoice(modelId?: string): { task?: "coding"; preferredModel?: string } {
  if (!modelId || modelId === "bob" || modelId === "auto") return {};
  if (modelId === "bob-coder") return { task: "coding" };
  return /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(modelId) ? { preferredModel: modelId } : {};
}

const problemOf = (error: unknown): ModelProblem => error instanceof ModelUnavailableError ? error.problem : "failed";

function logAttempt(fields: Record<string, unknown>) {
  // Operational metadata only: model, task, timings, outcome. Never prompts, answers or credentials.
  if (process.env.BOBAI_MODEL_ROUTING_LOG === "false") return;
  console.log(JSON.stringify({ event: "model_attempt", ...fields }));
}

type AttemptContext = { firstTokenTimeoutMs: number; onFirstToken: () => void };
type Attempt = (model: string, context: AttemptContext) => Promise<{ content: string; finishReason?: FinishReason }>;

async function route(task: RouteTask, messages: NativeMessage[], options: RouteOptions, attempt: Attempt): Promise<RouteResult> {
  const started = Date.now();
  const provider = await providerStatus();
  if (!provider.ready && provider.problem && NON_RETRYABLE.includes(provider.problem)) throw new ModelUnavailableError(provider.problem, provider.error ?? "Ollama is not available");
  let inventory = await getInventory();
  const requiredTokens = task === "vision" ? undefined : requiredContextTokens(messages);
  const fixed = strategy() === "fixed";
  const preferred = options.preferredModel || preferenceFor(task);
  if (fixed && !preferred) throw new ModelUnavailableError("no_model", "BOBAI_MODEL_ROUTING=fixed needs BOBAI_OLLAMA_MODEL");
  const tried = new Set<string>();
  let counted = 0, total = 0, refreshed = false, suggested: string | undefined;
  let lastError: unknown;
  while (Date.now() - started < routeBudgetMs() && total < 8) {
    if (options.signal?.aborted) throw options.signal.reason instanceof Error ? options.signal.reason : new DOMException("cancelled", "AbortError");
    let candidates = fixed ? [preferred!] : rankModels(inventory, task, { requiredTokens, preferredModel: options.preferredModel }).map((item) => item.name);
    // If discovery failed entirely, a configured preference is still worth one try.
    if (!candidates.length && !fixed && inventory.error && preferred) candidates = [preferred];
    candidates = candidates.filter((name) => !tried.has(name));
    if (suggested && candidates.includes(suggested)) candidates = [suggested, ...candidates.filter((name) => name !== suggested)];
    if (!candidates.length) {
      if (!refreshed && lastError && ["model_missing", "access_denied"].includes(problemOf(lastError))) { refreshed = true; invalidateInventory(); inventory = await getInventory({ refresh: true }); continue; }
      break;
    }
    const model = candidates[0];
    tried.add(model); total += 1;
    let firstTokenAt: number | undefined;
    const attemptStarted = Date.now();
    try {
      const remaining = routeBudgetMs() - (attemptStarted - started);
      const result = await attempt(model, { firstTokenTimeoutMs: Math.max(2_000, Math.min(firstTokenTimeoutMs(inventory.hosted), remaining)), onFirstToken: () => { firstTokenAt ??= Date.now(); } });
      const totalMs = Date.now() - attemptStarted;
      const firstTokenMs = firstTokenAt !== undefined ? firstTokenAt - attemptStarted : undefined;
      recordSuccess(model, { firstTokenMs, totalMs });
      logAttempt({ task, model, ok: true, firstTokenMs, totalMs, fallbacks: tried.size - 1 });
      return { content: result.content, model, fallbacks: tried.size - 1, ...(result.finishReason ? { finishReason: result.finishReason } : {}) };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const problem = problemOf(error);
      // A bad key or an unreachable server is not this model's fault, so it must not put the model on a cooldown.
      if (!NON_RETRYABLE.includes(problem)) recordFailure(model, problem);
      logAttempt({ task, model, ok: false, problem, totalMs: Date.now() - attemptStarted, partial: firstTokenAt !== undefined });
      lastError = error;
      // Text already reached the user: never splice a second model's answer onto it.
      if (firstTokenAt !== undefined) { if (error instanceof ModelUnavailableError) error.model = model; throw error; }
      if (NON_RETRYABLE.includes(problem)) providerCache = undefined;
      if (NON_RETRYABLE.includes(problem) || fixed) throw error;
      suggested = error instanceof ModelUnavailableError ? error.suggestedModel : undefined;
      // Denied or missing models fail instantly and cost nothing, so they do not use up the attempt budget.
      if (problem !== "access_denied" && problem !== "model_missing") counted += 1;
      if (counted >= maxAttempts()) break;
    }
  }
  if (lastError) {
    if (lastError instanceof ModelUnavailableError) throw lastError;
    throw new ModelUnavailableError("failed", lastError instanceof Error ? lastError.message : "every model attempt failed");
  }
  const reason = inventory.error ? `model discovery failed: ${inventory.error}` : task === "vision" ? "no vision-capable model is available" : "no compatible model is available";
  throw new ModelUnavailableError(inventory.error && !inventory.models.length ? "unreachable" : "no_model", reason);
}

export function routeChat(messages: NativeMessage[], options: RouteOptions = {}): Promise<RouteResult> {
  const task = classifyTask(messages, options.task);
  return route(task, messages, options, async (model) => ollamaChat(messages, task === "coding" ? "coding" : "bob", model, options.signal));
}

export function routeStream(messages: NativeMessage[], onToken: (token: string) => void, options: RouteOptions = {}): Promise<RouteResult> {
  const task = classifyTask(messages, options.task);
  return route(task, messages, options, async (model, context) => ollamaStream(messages, (token) => { context.onFirstToken(); onToken(token); }, task === "coding" ? "coding" : "bob", model, options.signal, { firstTokenTimeoutMs: context.firstTokenTimeoutMs }));
}

export function routeVision(imageBase64: string, prompt: string, options: Omit<RouteOptions, "task"> = {}): Promise<RouteResult> {
  return route("vision", [{ role: "user", content: prompt }], { ...options, task: "vision" }, async (model) => ollamaVision(imageBase64, prompt, options.signal, model));
}

export type RoutingProblem = ModelProblem | "discovery_failed" | "no_compatible_model" | "all_candidates_failed";
export type RoutingStatus = {
  ready: boolean;
  hosted: boolean;
  problem?: RoutingProblem;
  error?: string;
  discovery: { ok: boolean; models: number; stale: boolean; ageSeconds: number };
  picks: Partial<Record<RouteTask, string>>;
};

/** What the router would do right now, without running any inference. */
export async function routingStatus(): Promise<RoutingStatus> {
  const provider = await ollamaStatus();
  const empty = { ok: false, models: 0, stale: false, ageSeconds: 0 };
  if (!provider.ready) return { ready: false, hosted: provider.hosted, problem: provider.problem, error: provider.error, discovery: empty, picks: {} };
  const inventory = await getInventory();
  const discovery = { ok: !inventory.error, models: inventory.models.length, stale: Boolean(inventory.stale), ageSeconds: Math.round((Date.now() - inventory.fetchedAt) / 1000) };
  if (!inventory.models.length) return { ready: false, hosted: inventory.hosted, problem: inventory.error ? "discovery_failed" : "no_compatible_model", error: inventory.error, discovery, picks: {} };
  const picks: Partial<Record<RouteTask, string>> = {};
  for (const task of ["chat", "coding", "reasoning", "vision", "tool_decision"] as RouteTask[]) {
    const top = rankModels(inventory, task)[0];
    if (top) picks[task] = top.name;
  }
  if (!picks.chat) {
    const anyCompatible = inventory.models.some((model: ModelInfo) => model.capabilities.includes("completion"));
    return { ready: false, hosted: inventory.hosted, problem: anyCompatible ? "all_candidates_failed" : "no_compatible_model", discovery, picks };
  }
  return { ready: true, hosted: inventory.hosted, discovery, picks };
}
