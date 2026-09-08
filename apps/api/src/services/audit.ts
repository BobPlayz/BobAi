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
const MAX_METADATA_BYTES = 32 * 1024;
const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|credential|otp|code)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return value.length > 4_000 ? `${value.slice(0, 4_000)}...[truncated]` : value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 100)) output[key.slice(0, 200)] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(child, depth + 1);
  return output;
}

function safeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const value = sanitize(metadata);
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_METADATA_BYTES) return value as Record<string, unknown>;
    return { audit: "metadata truncated", originalSize: serialized.length };
  } catch {
    return { audit: "metadata unavailable" };
  }
}

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
      metadata: safeMetadata(input.metadata),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("audit log write failed", error);
  }
}
