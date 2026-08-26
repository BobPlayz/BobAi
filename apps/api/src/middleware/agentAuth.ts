import type { NextFunction, Request, Response } from "express";

/** Protect agent and external-side-effect operations. */
export function agentAuth(req: Request, res: Response, next: NextFunction) {
  const configuredKey = process.env.BOBAI_AGENT_KEY?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (!configuredKey) {
    if (isProduction) return res.status(503).json({ error: "agent operations are not configured" });
    return next();
  }

  const suppliedKey = req.header("x-bobai-agent-key");
  if (!suppliedKey || suppliedKey.length !== configuredKey.length || !timingSafeEqual(suppliedKey, configuredKey)) {
    return res.status(401).json({ error: "invalid agent credentials" });
  }
  return next();
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
