import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/** Protect agent operations and external side effects. Fail closed when no key is configured. */
export function agentAuth(req: Request, res: Response, next: NextFunction) {
  const configuredKey = process.env.BOBAI_AGENT_KEY?.trim();
  if (!configuredKey || configuredKey.length < 32) {
    return res.status(503).json({ error: "agent operations are not configured" });
  }

  const suppliedKey = req.header("x-bobai-agent-key");
  if (!suppliedKey) return res.status(401).json({ error: "invalid agent credentials" });

  const left = Buffer.from(suppliedKey);
  const right = Buffer.from(configuredKey);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return res.status(401).json({ error: "invalid agent credentials" });
  }

  return next();
}
