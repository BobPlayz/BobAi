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

const uuid = (value?: string) => value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : undefined;

export async function audit(event: AuditEvent) {
  const entry = {
    id: randomUUID(),
    ...event,
    userId: uuid(event.userId),
    sessionId: uuid(event.sessionId),
    workspaceId: uuid(event.workspaceId),
    resourceId: uuid(event.resourceId),
  };
  await db.insert(auditLogs).values(entry);
}
