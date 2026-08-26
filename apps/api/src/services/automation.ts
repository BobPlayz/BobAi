import { randomUUID } from "node:crypto";
import { generateImages } from "./mediaGeneration.js";

export type AutomationStep = { id?: string; type: "research" | "generate_image" | "generate_video" | "edit_video" | "upload" | "notify"; config?: Record<string, unknown> };
export type AutomationDefinition = { id: string; name: string; description?: string; trigger: { type: "manual" | "interval" | "webhook"; config?: Record<string, unknown> }; steps: AutomationStep[]; enabled: boolean; createdAt: string };
export type AutomationRun = { id: string; automationId: string; status: "running" | "completed" | "failed"; startedAt: string; completedAt?: string; steps: Array<{ id: string; type: AutomationStep["type"]; status: string; output?: unknown; error?: string }> };

const automations = new Map<string, AutomationDefinition>();
const runs = new Map<string, AutomationRun>();
const timers = new Map<string, NodeJS.Timeout>();
const PROVIDER_ENV: Record<"upload" | "notify", string> = { upload: "BOBAI_UPLOAD_PROVIDER_URL", notify: "BOBAI_NOTIFY_PROVIDER_URL" };

export const listAutomations = () => [...automations.values()];
export const getAutomation = (id: string) => automations.get(id) || null;
export const listAutomationRuns = (automationId?: string) => { const all = [...runs.values()]; return automationId ? all.filter((r) => r.automationId === automationId) : all; };

export function createAutomation(input: Omit<AutomationDefinition, "id" | "createdAt">) {
  const automation = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  automations.set(automation.id, automation);
  scheduleAutomation(automation);
  return automation;
}

export function scheduleAutomation(a: AutomationDefinition) {
  if (timers.has(a.id)) clearInterval(timers.get(a.id)!);
  if (!a.enabled || a.trigger.type !== "interval") return;
  const ms = Number(a.trigger.config?.intervalMs || 0);
  if (!Number.isFinite(ms) || ms < 10_000) return;
  timers.set(a.id, setInterval(() => { void runAutomation(a).catch(() => undefined); }, ms));
}

export function deleteAutomation(id: string) {
  const timer = timers.get(id);
  if (timer) clearInterval(timer);
  timers.delete(id);
  return automations.delete(id);
}

function configString(config: Record<string, unknown> | undefined, key: string) {
  return typeof config?.[key] === "string" ? config[key].trim() : "";
}

function configuredProviderUrl(name: keyof typeof PROVIDER_ENV) {
  const value = process.env[PROVIDER_ENV[name]]?.trim();
  if (!value) throw new Error(`${name} provider is not configured`);
  return value;
}

async function postProvider(url: string, body: Record<string, unknown>, tokenEnv?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = tokenEnv ? process.env[tokenEnv] : undefined;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  const raw = await response.text();
  let data: unknown = raw;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* provider may return plain text */ }
  if (!response.ok) throw new Error(`provider returned ${response.status}`);
  return data;
}

async function executeStep(step: AutomationStep, context: Record<string, unknown>) {
  const config = step.config || {};
  if (step.type === "research") {
    const query = configString(config, "query") || String(context.topic || "");
    if (!query) throw new Error("research query is required");
    return postProvider(process.env.BOBAI_RESEARCH_PROVIDER_URL?.trim() || (() => { throw new Error("research provider is not configured"); })(), { query, context }, "BOBAI_RESEARCH_PROVIDER_TOKEN");
  }
  if (step.type === "generate_image") return generateImages(configString(config, "prompt") || String(context.script || context.topic || ""));
  if (step.type === "generate_video") return postProvider(process.env.BOBAI_VIDEO_PROVIDER_URL?.trim() || (() => { throw new Error("video provider is not configured"); })(), { prompt: configString(config, "prompt") || String(context.script || context.topic || ""), context }, "BOBAI_VIDEO_PROVIDER_TOKEN");
  if (step.type === "edit_video") return postProvider(process.env.BOBAI_VIDEO_EDIT_PROVIDER_URL?.trim() || process.env.BOBAI_VIDEO_PROVIDER_URL?.trim() || (() => { throw new Error("video editing provider is not configured"); })(), { operation: "edit", ...config, context }, "BOBAI_VIDEO_PROVIDER_TOKEN");
  if (step.type === "upload" || step.type === "notify") {
    return postProvider(configuredProviderUrl(step.type), { ...config, context }, step.type === "upload" ? "BOBAI_UPLOAD_PROVIDER_TOKEN" : "BOBAI_NOTIFY_PROVIDER_TOKEN");
  }
  throw new Error(`unsupported automation step: ${step.type}`);
}

export async function runAutomation(a: AutomationDefinition, input: Record<string, unknown> = {}) {
  if (!a.enabled) throw new Error("automation is disabled");
  const run: AutomationRun = { id: randomUUID(), automationId: a.id, status: "running", startedAt: new Date().toISOString(), steps: [] };
  runs.set(run.id, run);
  const context = { ...input };
  try {
    for (const step of a.steps) {
      const record = { id: step.id || randomUUID(), type: step.type, status: "running" } as AutomationRun["steps"][number];
      run.steps.push(record);
      try {
        record.output = await executeStep(step, context);
        record.status = "completed";
        context[`step_${record.id}`] = record.output;
      } catch (error) {
        record.status = "failed";
        record.error = error instanceof Error ? error.message : "step failed";
        throw error;
      }
    }
    run.status = "completed";
    run.completedAt = new Date().toISOString();
    return run;
  } catch (error) {
    run.status = "failed";
    run.completedAt = new Date().toISOString();
    throw new Error(error instanceof Error ? error.message : "automation failed");
  }
}

export function createCodmContentAutomation() {
  return createAutomation({
    name: "COD trend video pipeline",
    description: "Research current COD trends, generate a video, edit it, and upload it through configured providers.",
    trigger: { type: "manual" }, enabled: true,
    steps: [
      { id: "research", type: "research", config: { query: "Call of Duty current popular content trends" } },
      { id: "video", type: "generate_video", config: { prompt: "Create a short Call of Duty video based on the research result with an engaging hook and platform-appropriate pacing." } },
      { id: "edit", type: "edit_video", config: { instructions: "Apply relevant cuts, captions, pacing, transitions, and audio mix for short-form gaming content." } },
      { id: "upload", type: "upload" },
    ],
  });
}
