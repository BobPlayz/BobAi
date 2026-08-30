import type { NextFunction, Request, Response } from "express";

const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_DEPTH = 20;
const MAX_NODES = 10_000;

function containsUnsafeKeys(value: unknown, depth = 0, state = { nodes: 0 }): boolean {
  if (value === null || typeof value !== "object") return false;
  if (++state.nodes > MAX_NODES || depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((item) => containsUnsafeKeys(item, depth + 1, state));
  return Object.entries(value).some(([key, child]) => BLOCKED_KEYS.has(key) || containsUnsafeKeys(child, depth + 1, state));
}

export function validateRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && containsUnsafeKeys(req.body)) return res.status(400).json({ error: "invalid request structure" });
  return next();
}
