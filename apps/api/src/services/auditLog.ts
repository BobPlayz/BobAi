import { randomUUID } from "node:crypto";
import { db, auditLogs } from "@bobai/db";

export type AuditEvent = {
  action: string;
  resourceType: string;
  userId?: string;
  sessionId?: string;
  workspaceId?: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};


const PRIVATE_KEY = /(password|passwd|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|credential|otp|prompt|content|transcript|recording|audio|image|base64|file.?data)/i;
function safeAuditValue(value: unknown, depth = 0, root = false): unknown {
  if (depth > 5) return "[truncated]";
  if (typeof value === "string") return root ? "[redacted]" : value.length > 1000 ? `${value.slice(0, 1000)}...[truncated]` : value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => safeAuditValue(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
    output[key.slice(0, 100)] = PRIVATE_KEY.test(key) ? "[redacted]" : safeAuditValue(child, depth + 1);
  }
  return output;
}

const uuid = (value?: string) => value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;

export async function audit(event: AuditEvent) {
  const entry = {
    id: randomUUID(),
    ...event,
    oldValue: safeAuditValue(event.oldValue, 0, true),
    newValue: safeAuditValue(event.newValue, 0, true),
    metadata: event.metadata ? safeAuditValue(event.metadata) as Record<string, unknown> : undefined,
    userId: uuid(event.userId),
    sessionId: uuid(event.sessionId),
    workspaceId: uuid(event.workspaceId),
    resourceId: uuid(event.resourceId),
  };
  await db.insert(auditLogs).values(entry);
}
