import type { Request } from "express";

/**
 * Capability-level guardrails. Keep these checks independent from provider code
 * so every future capability shares the same security boundary.
 */
export function assertCapabilityInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("capability input must be a JSON object");
  }
  return input as Record<string, unknown>;
}

export function assertOwnedWorkspace(req: Request) {
  if (!req.user?.id) throw new Error("authentication required");
  return req.user.id;
}
