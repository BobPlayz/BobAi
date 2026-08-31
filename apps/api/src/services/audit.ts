import { db, auditLogs } from "@bobai/db";

type AuditInput = {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

const MAX_TEXT = 2000;

export async function recordAudit(input: AuditInput) {
  try {
    await db.insert(auditLogs).values({
      action: input.action.slice(0, MAX_TEXT),
      resourceType: input.resourceType.slice(0, MAX_TEXT),
      resourceId: input.resourceId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
      ipAddress: input.ipAddress?.slice(0, 128),
      userAgent: input.userAgent?.slice(0, 1024),
      metadata: input.metadata,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("audit log write failed", error);
  }
}
