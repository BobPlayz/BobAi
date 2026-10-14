import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db, researchSessions } from "@bobai/db";
import { deepResearch } from "../services/deepResearch.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";
import { recordResearchSources, reserveResearchRequest } from "../services/researchQuota.js";

const router = Router();
const limit = createUserRateLimit(4, 60_000);

router.post("/", limit, async (req, res) => {
  try {
    const options = req.body?.options && typeof req.body.options === "object" && !Array.isArray(req.body.options)
      ? req.body.options as Record<string, unknown>
      : {};
    const reservation = await reserveResearchRequest(req.user!.id);
    const result = await deepResearch(req.body?.query, options);
    const quota = await recordResearchSources(req.user!.id, result.sources.length, reservation.windowStart);
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const sessionId = randomUUID();
    await db.insert(researchSessions).values({
      id: sessionId,
      workspaceId: workspace.id,
      userId: req.user!.id,
      query: result.query,
      sources: result.sources,
      answer: result.synthesis,
      status: "completed",
    });
    return res.json({ ...result, sessionId, quota, mode: "deep-research" });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("deep research failed", error);
    const message = error instanceof Error ? error.message : "deep research unavailable";
    if (/query is required|query is too long/i.test(message)) return res.status(400).json({ error: message });
    if (/quota exceeded/i.test(message)) return res.status(429).json({ error: message });
    return res.status(503).json({ error: "deep research unavailable" });
  }
});

export default router;
