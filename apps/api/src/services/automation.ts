import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, workflowRuns, workflows } from "@bobai/db";
import { generateImages } from "./mediaGeneration.js";

export type AutomationStep = { id?: string; type: "research" | "generate_image" | "generate_video" | "edit_video" | "upload" | "notify"; config?: Record<string, unknown> };
export type AutomationDefinition = { id: string; workspaceId: string; createdBy: string | null; name: string; description?: string; trigger: { type: "manual" | "interval" | "webhook"; config?: Record<string, unknown> }; steps: AutomationStep[]; enabled: boolean; createdAt: string };
export type AutomationRun = { id: string; automationId: string; status: "running" | "completed" | "failed"; startedAt: string; completedAt?: string; steps: Array<{ id: string; type: AutomationStep["type"]; status: string; output?: unknown; error?: string }> };

const timers = new Map<string, NodeJS.Timeout>();
const MAX_STEPS = 20;
const MAX_INPUT_BYTES = 256 * 1024;
const PROVIDER_ENV: Record<"upload" | "notify", string> = { upload: "BOBAI_UPLOAD_PROVIDER_URL", notify: "BOBAI_NOTIFY_PROVIDER_URL" };
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function safeSteps(value: unknown): AutomationStep[] { if (!Array.isArray(value) || value.length > MAX_STEPS) throw new Error("automation has too many steps"); return value.map((step) => { if (!isRecord(step) || typeof step.type !== "string" || !["research", "generate_image", "generate_video", "edit_video", "upload", "notify"].includes(step.type)) throw new Error("invalid automation step"); const config = isRecord(step.config) ? step.config : {}; return { id: typeof step.id === "string" && step.id.length <= 100 ? step.id : randomUUID(), type: step.type as AutomationStep["type"], config }; }); }
function toDefinition(row: typeof workflows.$inferSelect): AutomationDefinition { return { id: row.id, workspaceId: row.workspaceId, createdBy: row.createdBy, name: row.name, description: row.description || undefined, trigger: { type: row.triggerType as AutomationDefinition["trigger"]["type"], config: isRecord(row.triggerConfig) ? row.triggerConfig : {} }, steps: safeSteps(row.steps), enabled: row.isEnabled, createdAt: row.createdAt.toISOString() }; }

export async function listAutomations(workspaceId: string) { const rows = await db.select().from(workflows).where(and(eq(workflows.workspaceId, workspaceId), eq(workflows.isEnabled, true), eq(workflows.deletedAt, null))).orderBy(desc(workflows.updatedAt)); return rows.map(toDefinition); }
export async function getAutomation(id: string, workspaceId: string) { const [row] = await db.select().from(workflows).where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspaceId), eq(workflows.deletedAt, null))).limit(1); return row ? toDefinition(row) : null; }
export async function listAutomationRuns(workspaceId: string, automationId?: string) { const where = automationId ? and(eq(workflowRuns.workspaceId, workspaceId), eq(workflowRuns.workflowId, automationId)) : eq(workflowRuns.workspaceId, workspaceId); return db.select().from(workflowRuns).where(where).orderBy(desc(workflowRuns.startedAt)).limit(100); }

export async function createAutomation(input: Omit<AutomationDefinition, "id" | "createdAt" | "workspaceId" | "createdBy">, workspaceId: string, createdBy: string) {
  const steps = safeSteps(input.steps); const triggerType = input.trigger.type; if (!["manual", "interval", "webhook"].includes(triggerType)) throw new Error("unsupported trigger type");
  const [row] = await db.insert(workflows).values({ workspaceId, createdBy, name: input.name.trim().slice(0, 200), description: input.description?.trim().slice(0, 2_000) || null, triggerType, triggerConfig: input.trigger.config || {}, steps, isEnabled: input.enabled }).returning();
  if (!row) throw new Error("automation creation failed"); const definition = toDefinition(row); scheduleAutomation(definition); return definition;
}

export function scheduleAutomation(a: AutomationDefinition) {
  if (timers.has(a.id)) clearInterval(timers.get(a.id)!); timers.delete(a.id);
  if (!a.enabled || a.trigger.type !== "interval") return;
  const ms = Number(a.trigger.config?.intervalMs || 0); if (!Number.isFinite(ms) || ms < 10_000 || ms > 31 * 24 * 60 * 60 * 1000) return;
  timers.set(a.id, setInterval(() => { void runAutomation(a.id, a.workspaceId, a.createdBy || undefined).catch(() => undefined); }, ms));
}

export async function deleteAutomation(id: string, workspaceId: string) { const [row] = await db.update(workflows).set({ isEnabled: false, deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspaceId), eq(workflows.deletedAt, null))).returning({ id: workflows.id }); const timer = timers.get(id); if (timer) clearInterval(timer); timers.delete(id); return Boolean(row); }
function configString(config: Record<string, unknown> | undefined, key: string) { return typeof config?.[key] === "string" ? config[key].trim() : ""; }
function configuredProviderUrl(name: keyof typeof PROVIDER_ENV) { const value = process.env[PROVIDER_ENV[name]]?.trim(); if (!value) throw new Error(`${name} provider is not configured`); return value; }
async function postProvider(url: string, body: Record<string, unknown>, tokenEnv?: string) { const headers: Record<string, string> = { "content-type": "application/json" }; const token = tokenEnv ? process.env[tokenEnv] : undefined; if (token) headers.authorization = `Bearer ${token}`; const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000), redirect: "error" }); const raw = await response.text(); if (raw.length > 10 * 1024 * 1024) throw new Error("provider response too large"); let data: unknown = raw; try { data = raw ? JSON.parse(raw) : null; } catch {} if (!response.ok) throw new Error(`provider returned ${response.status}`); return data; }
async function executeStep(step: AutomationStep, context: Record<string, unknown>) { const config = step.config || {}; if (step.type === "research") { const query = configString(config, "query") || String(context.topic || ""); if (!query) throw new Error("research query is required"); return postProvider(process.env.BOBAI_RESEARCH_PROVIDER_URL?.trim() || (() => { throw new Error("research provider is not configured"); })(), { query, context }, "BOBAI_RESEARCH_PROVIDER_KEY"); } if (step.type === "generate_image") return generateImages(configString(config, "prompt") || String(context.script || context.topic || "")); if (step.type === "generate_video") return postProvider(process.env.BOBAI_VIDEO_PROVIDER_URL?.trim() || (() => { throw new Error("video provider is not configured"); })(), { prompt: configString(config, "prompt") || String(context.script || context.topic || ""), context }, "BOBAI_VIDEO_PROVIDER_KEY"); if (step.type === "edit_video") return postProvider(process.env.BOBAI_VIDEO_EDIT_PROVIDER_URL?.trim() || process.env.BOBAI_VIDEO_PROVIDER_URL?.trim() || (() => { throw new Error("video editing provider is not configured"); })(), { operation: "edit", ...config, context }, "BOBAI_VIDEO_EDIT_PROVIDER_KEY"); if (step.type === "upload" || step.type === "notify") return postProvider(configuredProviderUrl(step.type), { ...config, context }, step.type === "upload" ? "BOBAI_UPLOAD_PROVIDER_TOKEN" : "BOBAI_NOTIFY_PROVIDER_TOKEN"); throw new Error(`unsupported automation step: ${step.type}`); }

export async function runAutomation(id: string, workspaceId: string, userId?: string, input: Record<string, unknown> = {}) {
  const automation = await getAutomation(id, workspaceId); if (!automation) throw new Error("automation not found"); if (!automation.enabled) throw new Error("automation is disabled");
  const encoded = JSON.stringify(input); if (encoded.length > MAX_INPUT_BYTES) throw new Error("automation input is too large");
  const runId = randomUUID(); const runSteps: AutomationRun["steps"] = []; const startedAt = new Date();
  await db.insert(workflowRuns).values({ id: runId, workflowId: automation.id, workspaceId, startedBy: userId, status: "running", input, steps: runSteps, startedAt });
  const context = { ...input };
  try {
    for (const step of automation.steps) { const record = { id: step.id || randomUUID(), type: step.type, status: "running" } as AutomationRun["steps"][number]; runSteps.push(record); await db.update(workflowRuns).set({ steps: runSteps }).where(eq(workflowRuns.id, runId)); try { record.output = await executeStep(step, context); record.status = "completed"; context[`step_${record.id}`] = record.output; } catch (error) { record.status = "failed"; record.error = error instanceof Error ? error.message : "step failed"; await db.update(workflowRuns).set({ steps: runSteps, status: "failed", error: record.error, completedAt: new Date() }).where(eq(workflowRuns.id, runId)); throw error; } }
    const completedAt = new Date(); await db.update(workflowRuns).set({ steps: runSteps, status: "completed", output: context, completedAt }).where(eq(workflowRuns.id, runId)); await db.update(workflows).set({ lastRunAt: completedAt, updatedAt: completedAt }).where(eq(workflows.id, automation.id)); return { id: runId, automationId: automation.id, status: "completed" as const, startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString(), steps: runSteps };
  } catch (error) { throw new Error(error instanceof Error ? error.message : "automation failed"); }
}

export async function startAutomationWorker() { const rows = await db.select().from(workflows).where(and(eq(workflows.isEnabled, true), eq(workflows.deletedAt, null))); for (const row of rows) { try { scheduleAutomation(toDefinition(row)); } catch {} } }

export async function createCodmContentAutomation(workspaceId: string, createdBy: string) { return createAutomation({ name: "COD trend video pipeline", description: "Research current COD trends, generate a video, edit it, and upload it through configured providers.", trigger: { type: "manual", config: {} }, enabled: true, steps: [{ id: "research", type: "research", config: { query: "Call of Duty current popular content trends" } }, { id: "video", type: "generate_video", config: { prompt: "Create a short Call of Duty video based on the research result with an engaging hook and platform-appropriate pacing." } }, { id: "edit", type: "edit_video", config: { instructions: "Apply relevant cuts, captions, pacing, transitions, and audio mix for short-form gaming content." } }, { id: "upload", type: "upload" }] }, workspaceId, createdBy); }
