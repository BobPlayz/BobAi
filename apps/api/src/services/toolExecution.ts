import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, workspaceMembers } from "@bobai/db";
import { getTool, type BobTool } from "./toolRegistry.js";

export type ToolExecutionContext = { userId: string; workspaceId: string; approvalToken?: string };
export type ToolExecutionResult =
  | { status: "ready"; tool: BobTool }
  | { status: "approval_required"; tool: BobTool }
  | { status: "unauthorized"; tool: BobTool }
  | { status: "unavailable"; tool: BobTool; reason: string };

type ApprovalGrant = { userId: string; workspaceId: string; toolId: string; expiresAt: number };
const approvals = new Map<string, ApprovalGrant>();
const APPROVAL_TTL_MS = 2 * 60_000;
function cleanupApprovals() { const now = Date.now(); for (const [token, grant] of approvals) if (grant.expiresAt <= now) approvals.delete(token); }
setInterval(cleanupApprovals, 30_000).unref();

export async function issueToolApproval(toolId: string, userId: string, workspaceId: string) {
  const tool = getTool(toolId);
  if (!tool || !tool.requiresUserApproval) return null;
  const [membership] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))).limit(1);
  if (!membership) return null;
  cleanupApprovals();
  const token = randomBytes(32).toString("base64url");
  approvals.set(token, { userId, workspaceId, toolId, expiresAt: Date.now() + APPROVAL_TTL_MS });
  return { token, expiresIn: APPROVAL_TTL_MS / 1000 };
}

function consumeApproval(token: string | undefined, toolId: string, userId: string, workspaceId: string) {
  if (!token) return false;
  const grant = approvals.get(token);
  if (!grant || grant.expiresAt <= Date.now() || grant.toolId !== toolId || grant.userId !== userId || grant.workspaceId !== workspaceId) return false;
  approvals.delete(token);
  return true;
}

export async function prepareToolExecution(toolId: string, context: ToolExecutionContext): Promise<ToolExecutionResult> {
  const tool = getTool(toolId);
  if (!tool) throw new Error("tool not found");
  const workspaceId = context.workspaceId.trim();
  if (!workspaceId) return { status: "unauthorized", tool };
  try {
    const [membership] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, context.userId))).limit(1);
    if (!membership) return { status: "unauthorized", tool };
  } catch { return { status: "unavailable", tool, reason: "authorization service is unavailable" }; }
  if (tool.requiresUserApproval && !consumeApproval(context.approvalToken, tool.id, context.userId, workspaceId)) return { status: "approval_required", tool };
  if (!providerConfigured(tool.id)) return { status: "unavailable", tool, reason: "provider is not configured" };
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
