import { deepResearch } from "./deepResearch.js";
import { executeProviderCapability } from "./capabilityProviders.js";
import { queueBackgroundTask } from "./agentCoordinator.js";
import { getTool, type BobTool } from "./toolRegistry.js";
import { prepareToolExecution, type ToolExecutionContext } from "./toolExecution.js";
import { assertPublicTargetUrl, boundedText, providerUrl, safeError } from "./httpSafety.js";

export type ToolLoopMessage = { role: "system" | "user" | "assistant"; content: string };
export type ToolLoopContext = ToolExecutionContext & { modelId?: string; mode?: string; maxRounds?: number };
export type ToolLoopResult = { status: "completed" | "approval_required" | "failed" | "limit_reached"; message: string; toolCalls: number; usedTools: string[]; backgroundJobIds: string[] };
type Executor = (args: Record<string, unknown>, context: ToolLoopContext) => Promise<unknown>;
const MAX_ROUNDS = 6;
const MAX_TOOL_CALLS = 6;
const MAX_TOOL_RESULT_CHARS = 20_000;

function externalProviderUrl(toolId: string): string | undefined {
  switch (toolId) {
    case "browser": case "website-test": return process.env.BOBAI_BROWSER_PROVIDER_URL?.trim();
    case "documents": return process.env.BOBAI_DOCUMENTS_PROVIDER_URL?.trim();
    case "knowledge": return process.env.BOBAI_KNOWLEDGE_PROVIDER_URL?.trim();
    case "data-analysis": return process.env.BOBAI_DATA_ANALYSIS_PROVIDER_URL?.trim();
    default: return undefined;
  }
}

async function callConfiguredProvider(tool: BobTool, args: Record<string, unknown>): Promise<unknown> {
  const raw = externalProviderUrl(tool.id);
  if (!raw) throw new Error(`${tool.id} provider is not configured`);
  const url = providerUrl(raw);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), tool.timeoutMs);
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const keyEnv = tool.id === "browser" || tool.id === "website-test" ? "BOBAI_BROWSER_PROVIDER_KEY" : tool.id === "documents" ? "BOBAI_DOCUMENTS_PROVIDER_KEY" : tool.id === "knowledge" ? "BOBAI_KNOWLEDGE_PROVIDER_KEY" : "BOBAI_DATA_ANALYSIS_PROVIDER_KEY";
    const key = process.env[keyEnv]?.trim();
    if (key) headers.authorization = `Bearer ${key}`;
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ tool: tool.id, ...args }), signal: controller.signal, redirect: "error" });
    const text = await boundedText(response, tool.maxResultBytes);
    if (!response.ok) throw new Error(`tool provider returned ${response.status}`);
    try { return JSON.parse(text); } catch { return { data: text }; }
  } finally { clearTimeout(timeout); }
}

const EXECUTORS: Record<string, Executor> = {
  research: async (args) => deepResearch(args.query),
  browser: async (args) => { await assertPublicTargetUrl(args.url); return callConfiguredProvider(getTool("browser")!, args); },
  "website-test": async (args) => { await assertPublicTargetUrl(args.url); return callConfiguredProvider(getTool("website-test")!, args); },
  documents: async (args) => callConfiguredProvider(getTool("documents")!, args),
  knowledge: async (args) => callConfiguredProvider(getTool("knowledge")!, args),
  "data-analysis": async (args) => callConfiguredProvider(getTool("data-analysis")!, args),
  diagrams: async (args) => executeProviderCapability("diagram_generation", args),
  "sketch-to-ui": async (args) => executeProviderCapability("sketch_to_ui", args),
  voice: async (args) => executeProviderCapability(args.operation === "transcribe" ? "speech_to_text" : "voice_synthesis", args),
  image: async (args) => executeProviderCapability("image_editing", args),
  video: async (args) => executeProviderCapability("video_generation", args),
  music: async (args) => executeProviderCapability("music_generation", args),
  automation: async (args, context) => {
    const automationId = typeof args.automationId === "string" ? args.automationId : "";
    return queueBackgroundTask({ description: `run approved automation ${automationId}`, mode: context.mode, context: { workspaceId: context.workspaceId, createdBy: context.userId } });
  },
  coding: async (args, context) => queueBackgroundTask({ description: String(args.task), mode: context.mode, context: { workspaceId: context.workspaceId, createdBy: context.userId } }),
};

export function hasToolExecutor(toolId: string): boolean { return typeof EXECUTORS[toolId] === "function"; }

export async function executeApprovedTool(toolId: string, args: Record<string, unknown>, context: ToolLoopContext): Promise<unknown> {
  const prepared = await prepareToolExecution(toolId, { ...context, arguments: args });
  if (prepared.status !== "ready") return prepared;
  const executor = EXECUTORS[toolId];
  if (!executor) return { status: "unavailable", tool: prepared.tool, reason: "no executor registered" };
  return executor(args, context);
}

export function serializeToolResult(value: unknown): string {
  let text: string;
  try { text = JSON.stringify(value); } catch { text = "[unserializable tool result]"; }
  return text.slice(0, MAX_TOOL_RESULT_CHARS);
}

export async function runToolLoop(initialMessages: ToolLoopMessage[], context: ToolLoopContext, decide: (messages: ToolLoopMessage[], modelId?: string) => Promise<{ action: "respond" | "use_tools"; calls: Array<{ tool: string; arguments: Record<string, unknown> }>; reason?: string }>, respond: (messages: ToolLoopMessage[], modelId?: string) => Promise<{ content: string }>): Promise<ToolLoopResult> {
  let messages = [...initialMessages];
  const usedTools: string[] = [];
  const backgroundJobIds: string[] = [];
  let toolCalls = 0;
  const rounds = Math.min(Math.max(Math.floor(context.maxRounds ?? MAX_ROUNDS), 1), MAX_ROUNDS);
  for (let round = 0; round < rounds; round++) {
    if (process.env.BOBAI_TOOLS_ENABLED === "false") {
      const response = await respond(messages, context.modelId);
      return { status: "completed", message: response.content, toolCalls, usedTools, backgroundJobIds };
    }
    const decision = await decide(messages, context.modelId);
    if (decision.action === "respond") {
      const response = await respond(messages, context.modelId);
      return { status: "completed", message: response.content, toolCalls, usedTools, backgroundJobIds };
    }
    if (decision.calls.length > MAX_TOOL_CALLS - toolCalls) return { status: "limit_reached", message: "BobAI reached the maximum number of tool calls for this request.", toolCalls, usedTools, backgroundJobIds };
    for (const call of decision.calls) {
      const tool = getTool(call.tool);
      if (!tool) return { status: "failed", message: "selected tool is unavailable", toolCalls, usedTools, backgroundJobIds };
      if (tool.requiresUserApproval && !context.approvalToken) return { status: "approval_required", message: `${tool.name} requires user approval before BobAI can execute it.`, toolCalls, usedTools: [...usedTools, tool.id], backgroundJobIds };
      try {
        const result = await executeApprovedTool(tool.id, call.arguments, context);
        if (result && typeof result === "object" && "status" in result && (result as { status?: string }).status === "approval_required") return { status: "approval_required", message: `${tool.name} requires user approval before BobAI can execute it.`, toolCalls, usedTools: [...usedTools, tool.id], backgroundJobIds };
        toolCalls += 1;
        usedTools.push(tool.id);
        if (result && typeof result === "object" && "id" in result && (tool.id === "coding" || tool.id === "automation")) backgroundJobIds.push(String((result as { id: string }).id));
        messages.push({ role: "assistant", content: `[bob requested tool: ${tool.id}]` });
        messages.push({ role: "user", content: `[untrusted tool result for ${tool.id}]\n${serializeToolResult(result)}\n[/untrusted tool result]` });
      } catch (error) {
        toolCalls += 1;
        usedTools.push(tool.id);
        messages.push({ role: "assistant", content: `[bob requested tool: ${tool.id}]` });
        messages.push({ role: "user", content: `[untrusted tool error for ${tool.id}]\n${safeError(error)}\n[/untrusted tool error]` });
      }
    }
  }
  return { status: "limit_reached", message: "BobAI reached the maximum tool-planning rounds without a final answer.", toolCalls, usedTools, backgroundJobIds };
}
