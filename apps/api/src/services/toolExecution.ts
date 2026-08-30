import { getTool, type BobTool } from "./toolRegistry.js";

export type ToolExecutionContext = {
  userId: string;
  workspaceId: string;
  approved: boolean;
};

export type ToolExecutionResult =
  | { status: "ready"; tool: BobTool }
  | { status: "approval_required"; tool: BobTool }
  | { status: "unavailable"; tool: BobTool; reason: string };

/**
 * Central execution gate. Concrete providers must be attached here instead of
 * letting arbitrary model output invoke URLs, shells, filesystems, or secrets.
 */
export function prepareToolExecution(toolId: string, context: ToolExecutionContext): ToolExecutionResult {
  const tool = getTool(toolId);
  if (!tool) throw new Error("tool not found");
  if (tool.requiresUserApproval && !context.approved) return { status: "approval_required", tool };

  const configured = providerConfigured(tool.id);
  if (!configured) return { status: "unavailable", tool, reason: "provider is not configured" };
  return { status: "ready", tool };
}

function providerConfigured(toolId: string): boolean {
  switch (toolId) {
    case "research": return Boolean(process.env.BOBAI_RESEARCH_PROVIDER_URL);
    case "browser": return Boolean(process.env.BOBAI_BROWSER_PROVIDER_URL);
    case "coding": return Boolean(process.env.BOBAI_CODING_AGENT_KEY && process.env.BOBAI_CODING_AGENTS_DIR);
    case "website-test": return Boolean(process.env.BOBAI_BROWSER_PROVIDER_URL);
    case "voice": return Boolean(process.env.BOBAI_VOICE_PROVIDER_URL);
    case "image": return Boolean(process.env.BOBAI_IMAGE_PROVIDER_URL);
    case "video": return Boolean(process.env.BOBAI_VIDEO_PROVIDER_URL);
    case "music": return Boolean(process.env.BOBAI_MUSIC_PROVIDER_URL);
    default: return true;
  }
}
