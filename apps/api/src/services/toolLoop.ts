import { getTool, type BobTool } from "./toolRegistry.js";
import { randomUUID } from "node:crypto";
import { db, images, researchSessions } from "@bobai/db";
import { recordResearchSources, reserveResearchRequest } from "./researchQuota.js";
import type { ToolExecutionContext } from "./toolExecution.js";
import { assertPublicTargetUrl, boundedText, providerUrl, safeError } from "./httpSafety.js";

export type ToolLoopMessage = { role: "system" | "user" | "assistant"; content: string };
export type ToolLoopContext = ToolExecutionContext & { modelId?: string; mode?: string; maxRounds?: number; signal?: AbortSignal };
export type ToolLoopResult = { status: "completed" | "approval_required" | "failed" | "limit_reached" | "cancelled"; message: string; toolCalls: number; usedTools: string[]; backgroundJobIds: string[] };
type Executor = (args: Record<string, unknown>, context: ToolLoopContext) => Promise<unknown>;
const MAX_ROUNDS = 6, MAX_TOOL_CALLS = 6, MAX_TOOL_RESULT_CHARS = 20_000;

function externalProviderUrl(toolId: string): string | undefined {
  switch (toolId) {
    case "browser": case "website-test": return process.env.BOBAI_BROWSER_PROVIDER_URL?.trim();
    case "documents": return process.env.BOBAI_DOCUMENTS_PROVIDER_URL?.trim();
    case "knowledge": return process.env.BOBAI_KNOWLEDGE_PROVIDER_URL?.trim();
    case "data-analysis": return process.env.BOBAI_DATA_ANALYSIS_PROVIDER_URL?.trim();
    case "computer": case "paint": case "blender": return process.env.BOBAI_COMPUTER_PROVIDER_URL?.trim();
    default: return undefined;
  }
}
function providerKeyEnv(toolId: string): string {
  if (toolId === "browser" || toolId === "website-test") return "BOBAI_BROWSER_PROVIDER_KEY";
  if (toolId === "documents") return "BOBAI_DOCUMENTS_PROVIDER_KEY";
  if (toolId === "knowledge") return "BOBAI_KNOWLEDGE_PROVIDER_KEY";
  if (toolId === "computer" || toolId === "paint" || toolId === "blender") return "BOBAI_COMPUTER_PROVIDER_KEY";
  return "BOBAI_DATA_ANALYSIS_PROVIDER_KEY";
}
async function callConfiguredProvider(tool: BobTool, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  const raw = externalProviderUrl(tool.id); if (!raw) throw new Error(`${tool.id} provider is not configured`);
  const url = providerUrl(raw); const controller = new AbortController(); const onAbort = () => controller.abort(signal?.reason); if (signal?.aborted) controller.abort(signal.reason); else signal?.addEventListener("abort", onAbort, { once: true }); const timeout = setTimeout(() => controller.abort(new Error("tool provider timed out")), tool.timeoutMs);
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const key = process.env[providerKeyEnv(tool.id)]?.trim(); if (key) headers.authorization = `Bearer ${key}`;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ tool: tool.id, ...args }), signal: controller.signal, redirect: "error" });
    const text = await boundedText(response, tool.maxResultBytes); if (!response.ok) throw new Error(`tool provider returned ${response.status}`);
    try { return JSON.parse(text); } catch { return { data: text }; }
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", onAbort); }
}

const EXECUTORS: Record<string, Executor> = {
  research: async (args, context) => {
    const reservation = await reserveResearchRequest(context.userId);
    const result = await (await import("./deepResearch.js")).deepResearch(args.query, {}, context.signal);
    await recordResearchSources(context.userId, result.sources.length, reservation.windowStart);
    const sessionId = randomUUID();
    await db.insert(researchSessions).values({
      id: sessionId, workspaceId: context.workspaceId, userId: context.userId,
      query: result.query, sources: result.sources, answer: result.synthesis, status: "completed",
    });
    return {
      sessionId, query: result.query, synthesis: result.synthesis,
      sources: result.sources.map((source, index) => ({
        index: index + 1, title: source.title, url: source.url,
        snippet: source.snippet, score: source.score, credibility: source.credibility,
      })),
      evidenceCount: result.evidence.length,
    };
  },
  browser: async (args, context) => { await assertPublicTargetUrl(args.url); return callConfiguredProvider(getTool("browser")!, args, context.signal); },
  "website-test": async (args, context) => { await assertPublicTargetUrl(args.url); return callConfiguredProvider(getTool("website-test")!, args, context.signal); },
  computer: async (args, context) => callConfiguredProvider(getTool("computer")!, args, context.signal),
  paint: async (args, context) => callConfiguredProvider(getTool("paint")!, args, context.signal),
  blender: async (args, context) => callConfiguredProvider(getTool("blender")!, args, context.signal),
  documents: async (args, context) => callConfiguredProvider(getTool("documents")!, args, context.signal),
  knowledge: async (args, context) => callConfiguredProvider(getTool("knowledge")!, args, context.signal),
  "data-analysis": async (args, context) => callConfiguredProvider(getTool("data-analysis")!, args, context.signal),
  diagrams: async (args) => (await import("./capabilityProviders.js")).executeProviderCapability("diagram_generation", args),
  "sketch-to-ui": async (args) => (await import("./capabilityProviders.js")).executeProviderCapability("sketch_to_ui", args),
  voice: async (args) => { if (args.operation !== "synthesize" || typeof args.text !== "string") throw new Error("local voice tool supports synthesis and requires text"); return (await import("./voice.js")).synthesize(args.text); },
  image: async (args, context) => {
    if (typeof args.prompt !== "string") throw new Error("image prompt is required");
    const prompt = args.prompt.trim();
    const count = typeof args.count === "number" ? Math.min(4, Math.max(1, Math.floor(args.count))) : 1;
    const generated = await (await import("./mediaGeneration.js")).generateImages(prompt, count, undefined, context.signal);
    if (!generated.length || generated.length > count) throw new Error("image generation returned an invalid image list");
    for (const item of generated) {
      if (typeof item.url !== "string" || item.url.length > 12 * 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(item.url)) {
        throw new Error("image generation returned invalid PNG data");
      }
    }
    const rows = await db.insert(images).values(generated.map((item) => ({
      workspaceId: context.workspaceId, createdBy: context.userId, prompt,
      model: "local-diffusers", width: 512, height: 512, seed: null,
      operation: "generate", metadata: { url: item.url, index: item.index, source: "local", origin: "chat-tool" },
    }))).returning({ id: images.id, createdAt: images.createdAt });
    return {
      generated: true, count: rows.length,
      images: rows.map((row, index) => ({ id: row.id, createdAt: row.createdAt, prompt, index: generated[index].index })),
      retrieval: "Use GET /v1/images/:id to retrieve each generated image.",
    };
  },
  video: async (args) => (await import("./capabilityProviders.js")).executeProviderCapability("video_generation", args),
  music: async (args) => (await import("./capabilityProviders.js")).executeProviderCapability("music_generation", args),
  automation: async (args, context) => { const automationId = typeof args.automationId === "string" ? args.automationId.trim() : ""; if (!automationId) throw new Error("automation id is required"); return (await import("./automation.js")).runAutomation(automationId, context.workspaceId, context.userId); },
  coding: async (args, context) => (await import("./agentCoordinator.js")).queueBackgroundTask({ description: String(args.task), mode: context.mode, context: { workspaceId: context.workspaceId, createdBy: context.userId } }),
};

export function hasToolExecutor(toolId: string): boolean { return typeof EXECUTORS[toolId] === "function"; }
export async function executeApprovedTool(toolId: string, args: Record<string, unknown>, context: ToolLoopContext): Promise<unknown> {
  const { prepareToolExecution } = await import("./toolExecution.js"); const { recordAudit } = await import("./audit.js");
  const prepared = await prepareToolExecution(toolId, { ...context, arguments: args });
  if (prepared.status !== "ready") { await recordAudit({ action: "tool_execution_denied", resourceType: "tool", userId: context.userId, workspaceId: context.workspaceId, metadata: { toolId, status: prepared.status } }); return prepared; }
  const executor = EXECUTORS[toolId]; if (!executor) return { status: "unavailable", tool: prepared.tool, reason: "no executor registered" };
  await recordAudit({ action: "tool_execution_started", resourceType: "tool", userId: context.userId, workspaceId: context.workspaceId, metadata: { toolId } });
  try { const result = await executor(args, context); await recordAudit({ action: "tool_execution_completed", resourceType: "tool", userId: context.userId, workspaceId: context.workspaceId, metadata: { toolId } }); return result; }
  catch (error) { await recordAudit({ action: "tool_execution_failed", resourceType: "tool", userId: context.userId, workspaceId: context.workspaceId, metadata: { toolId, error: safeError(error) } }); throw error; }
}
export function serializeToolResult(value: unknown): string { let text = "[unserializable tool result]"; try { const serialized = JSON.stringify(value); if (typeof serialized === "string") text = serialized; } catch {} return text.slice(0, MAX_TOOL_RESULT_CHARS); }
export async function runToolLoop(initialMessages: ToolLoopMessage[], context: ToolLoopContext, decide: (messages: ToolLoopMessage[], modelId?: string) => Promise<{ action: "respond" | "use_tools"; calls: Array<{ tool: string; arguments: Record<string, unknown> }>; reason?: string }>, respond: (messages: ToolLoopMessage[], modelId?: string) => Promise<{ content: string }>, execute: (toolId: string, args: Record<string, unknown>, context: ToolLoopContext) => Promise<unknown> = executeApprovedTool): Promise<ToolLoopResult> {
  let messages = [...initialMessages]; const usedTools: string[] = []; const backgroundJobIds: string[] = []; let toolCalls = 0;
  const rounds = Math.min(Math.max(Math.floor(context.maxRounds ?? MAX_ROUNDS), 1), MAX_ROUNDS);
  const throwIfAborted = () => { if (context.signal?.aborted) throw context.signal.reason instanceof Error ? context.signal.reason : new Error("tool loop cancelled"); };
  try {
  for (let round = 0; round < rounds; round++) {
    throwIfAborted();
    if (process.env.BOBAI_TOOLS_ENABLED === "false") { const response = await respond(messages, context.modelId); return { status: "completed", message: response.content, toolCalls, usedTools, backgroundJobIds }; }
    const decision = await decide(messages, context.modelId); throwIfAborted();
    if (decision.action === "respond") { const response = await respond(messages, context.modelId); throwIfAborted(); return { status: "completed", message: response.content, toolCalls, usedTools, backgroundJobIds }; }
    if (decision.calls.length > MAX_TOOL_CALLS - toolCalls) return { status: "limit_reached", message: "BobAI reached the maximum number of tool calls for this request.", toolCalls, usedTools, backgroundJobIds };
    for (const call of decision.calls) {
      throwIfAborted();
      const tool = getTool(call.tool); if (!tool) return { status: "failed", message: "selected tool is unavailable", toolCalls, usedTools, backgroundJobIds };
      if (tool.requiresUserApproval && !context.approvalToken) return { status: "approval_required", message: `${tool.name} requires user approval before BobAI can execute it.`, toolCalls, usedTools: [...usedTools, tool.id], backgroundJobIds };
      try {
        const result = await execute(tool.id, call.arguments, context); throwIfAborted();
        if (result && typeof result === "object" && "status" in result && (result as { status?: string }).status === "approval_required") return { status: "approval_required", message: `${tool.name} requires user approval before BobAI can execute it.`, toolCalls, usedTools: [...usedTools, tool.id], backgroundJobIds };
        toolCalls += 1; usedTools.push(tool.id);
        if (result && typeof result === "object" && "id" in result && (tool.id === "coding" || tool.id === "automation")) backgroundJobIds.push(String((result as { id: string }).id));
        messages.push({ role: "assistant", content: `[bob requested tool: ${tool.id}]` }); messages.push({ role: "user", content: `[untrusted tool result for ${tool.id}]\n${serializeToolResult(result)}\n[/untrusted tool result]` });
      } catch (error) {
        if (context.signal?.aborted) throw error;
        toolCalls += 1; usedTools.push(tool.id); messages.push({ role: "assistant", content: `[bob requested tool: ${tool.id}]` }); messages.push({ role: "user", content: `[untrusted tool error for ${tool.id}]\n${safeError(error)}\n[/untrusted tool error]` });
      }
    }
  }
  return { status: "limit_reached", message: "BobAI reached the maximum tool-planning rounds without a final answer.", toolCalls, usedTools, backgroundJobIds };
  } catch (error) {
    if (context.signal?.aborted) return { status: "cancelled", message: "Request cancelled.", toolCalls, usedTools, backgroundJobIds };
    throw error;
  }
}
