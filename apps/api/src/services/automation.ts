import { randomUUID } from "node:crypto";
import { generateImages } from "./mediaGeneration.js";

export type AutomationStep = { id?: string; type: "research" | "generate_image" | "generate_video" | "edit_video" | "upload" | "notify"; config?: Record<string, unknown> };
export type AutomationDefinition = { id: string; name: string; description?: string; trigger: { type: "manual" | "cron" | "webhook"; config?: Record<string, unknown> }; steps: AutomationStep[]; enabled: boolean; createdAt: string };
export type AutomationRun = { id: string; automationId: string; status: "running" | "completed" | "failed"; startedAt: string; completedAt?: string; steps: Array<{ id: string; type: AutomationStep["type"]; status: string; output?: unknown; error?: string }> };

const automations = new Map<string, AutomationDefinition>();
const runs = new Map<string, AutomationRun>();

export const listAutomations = () => [...automations.values()];
export const getAutomation = (id: string) => automations.get(id) || null;
export const listAutomationRuns = (automationId?: string) => { const all = [...runs.values()]; return automationId ? all.filter((r) => r.automationId === automationId) : all; };

export function createAutomation(input: Omit<AutomationDefinition, "id" | "createdAt">) {
  const automation = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  automations.set(automation.id, automation);
  return automation;
}

function configString(config: Record<string, unknown> | undefined, key: string) { return typeof config?.[key] === "string" ? String(config[key]).trim() : ""; }

async function postProvider(url: string, body: Record<string, unknown>, tokenEnv?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = tokenEnv ? process.env[tokenEnv] : undefined;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const raw = await response.text();
  let data: unknown = raw;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* plain text */ }
  if (!response.ok) throw new Error(`provider returned ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

async function executeStep(step: AutomationStep, context: Record<string, unknown>) {
  const config = step.config || {};
  if (step.type === "research") {
    const query = configString(config, "query") || String(context.topic || "");
    const provider = process.env.BOBAI_RESEARCH_PROVIDER_URL;
    if (!query) throw new Error("research step requires query or topic");
    if (!provider) throw new Error("BOBAI_RESEARCH_PROVIDER_URL is not configured");
    return postProvider(provider, { query, context }, "BOBAI_RESEARCH_PROVIDER_TOKEN");
  }
  if (step.type === "generate_image") return generateImages(configString(config, "prompt") || String(context.script || context.topic || ""));
  if (step.type === "generate_video") {
    const provider = process.env.BOBAI_VIDEO_PROVIDER_URL;
    if (!provider) throw new Error("BOBAI_VIDEO_PROVIDER_URL is not configured");
    return postProvider(provider, { prompt: configString(config, "prompt") || String(context.script || context.topic || ""), context }, "BOBAI_VIDEO_PROVIDER_TOKEN");
  }
  if (step.type === "edit_video") {
    const provider = process.env.BOBAI_VIDEO_EDIT_PROVIDER_URL || process.env.BOBAI_VIDEO_PROVIDER_URL;
    if (!provider) throw new Error("video editing provider is not configured");
    return postProvider(provider, { operation: "edit", ...config, context }, "BOBAI_VIDEO_PROVIDER_TOKEN");
  }
  if (step.type === "upload" || step.type === "notify") {
    const provider = configString(config, "providerUrl");
    if (!provider) throw new Error(`${step.type} step requires providerUrl`);
    return postProvider(provider, { ...config, context }, step.type === "upload" ? "BOBAI_UPLOAD_PROVIDER_TOKEN" : "BOBAI_NOTIFY_PROVIDER_TOKEN");
  }
  throw new Error(`unsupported automation step: ${step.type}`);
}

export async function runAutomation(automation: AutomationDefinition, input: Record<string, unknown> = {}) {
  if (!automation.enabled) throw new Error("automation is disabled");
  const run: AutomationRun = { id: randomUUID(), automationId: automation.id, status: "running", startedAt: new Date().toISOString(), steps: [] };
  runs.set(run.id, run);
  const context = { ...input } as Record<string, unknown>;
  try {
    for (const step of automation.steps) {
      const record = { id: step.id || randomUUID(), type: step.type, status: "running" } as AutomationRun["steps"][number];
      run.steps.push(record);
      try { record.output = await executeStep(step, context); record.status = "completed"; context[`step_${record.id}`] = record.output; }
      catch (error) { record.status = "failed"; record.error = error instanceof Error ? error.message : "step failed"; throw error; }
    }
    run.status = "completed"; run.completedAt = new Date().toISOString(); return run;
  } catch (error) {
    run.status = "failed"; run.completedAt = new Date().toISOString();
    throw Object.assign(new Error(error instanceof Error ? error.message : "automation failed"), { run });
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
      { id: "upload", type: "upload", config: { providerUrl: process.env.BOBAI_UPLOAD_PROVIDER_URL || "" } },
    ],
  });
}
