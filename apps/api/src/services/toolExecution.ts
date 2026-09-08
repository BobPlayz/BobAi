import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, toolApprovals, workspaceMembers } from "@bobai/db";
import { getTool, type BobTool } from "./toolRegistry.js";
import { recordAudit } from "./audit.js";

export type ToolExecutionContext = { userId: string; workspaceId: string; approvalToken?: string };
export type ToolExecutionResult =
  | { status: "ready"; tool: BobTool }
  | { status: "approval_required"; tool: BobTool }
  | { status: "unauthorized"; tool: BobTool }
  | { status: "unavailable"; tool: BobTool; reason: string };

const APPROVAL_TTL_MS = 2 * 60_000;
const hashApprovalToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueToolApproval(toolId: string, userId: string, workspaceId: string) {
  const tool = getTool(toolId);
  if (!tool || !tool.requiresUserApproval) return null;
  const [membership] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))).limit(1);
  if (!membership) return null;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
  await db.insert(toolApprovals).values({ userId, workspaceId, kind: "tool", toolId: tool.id, targetName: tool.name, tokenHash: hashApprovalToken(token), expiresAt });
  await recordAudit({ action: "tool_approval_issued", resourceType: "tool_approval", userId, workspaceId, metadata: { toolId: tool.id } });
  return { token, expiresIn: APPROVAL_TTL_MS / 1000 };
}

async function consumeApproval(token: string | undefined, toolId: string, userId: string, workspaceId: string) {
  if (!token) return false;
  const now = new Date();
  const [grant] = await db.update(toolApprovals).set({ consumedAt: now }).where(and(eq(toolApprovals.tokenHash, hashApprovalToken(token)), eq(toolApprovals.kind, "tool"), eq(toolApprovals.userId, userId), eq(toolApprovals.workspaceId, workspaceId), eq(toolApprovals.toolId, toolId), isNull(toolApprovals.consumedAt), gt(toolApprovals.expiresAt, now))).returning({ id: toolApprovals.id });
  if (grant) await recordAudit({ action: "tool_approval_consumed", resourceType: "tool_approval", resourceId: grant.id, userId, workspaceId, metadata: { toolId } });
  return Boolean(grant);
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
  if (!providerConfigured(tool.id)) return { status: "unavailable", tool, reason: "provider is not configured" };
  if (tool.requiresUserApproval && !await consumeApproval(context.approvalToken, tool.id, context.userId, workspaceId)) return { status: "approval_required", tool };
  return { status: "ready", tool };
}

export async function cleanupExpiredToolApprovals() {
  await db.delete(toolApprovals).where(lt(toolApprovals.expiresAt, new Date()));
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
