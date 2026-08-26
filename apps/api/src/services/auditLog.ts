import { randomUUID } from "node:crypto";

export type AuditEvent = {
  action: string;
  userId?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

export function audit(event: AuditEvent) {
  const entry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    ...event
  };

  console.info("AUDIT", JSON.stringify(entry));
}
