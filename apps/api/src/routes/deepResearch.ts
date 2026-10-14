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
  const controller = new AbortController();
  const onDisconnect = () => { if (!res.writableEnded) controller.abort(new Error("client disconnected")); };
  req.once("aborted", onDisconnect);
  res.once("close", onDisconnect);
  try {
    const options = req.body?.options && typeof req.body.options === "object" && !Array.isArray(req.body.options)
      ? req.body.options as Record<string, unknown>
      : {};
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (!query) return res.status(400).json({ error: "research query is required" });
    if (query.length > 2_000) return res.status(400).json({ error: "research query is too long" });
    const reservation = await reserveResearchRequest(req.user!.id);
    const result = await deepResearch(query, options, controller.signal);
    if (controller.signal.aborted || res.destroyed) return;
    const quota = await recordResearchSources(req.user!.id, result.sources.length, reservation.windowStart);
    if (controller.signal.aborted || res.destroyed) return;
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    if (controller.signal.aborted || res.destroyed) return;
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
    const citations = result.sources.map((source, index) => ({ id: `${sessionId}:${index + 1}`, index: index + 1, title: source.title, url: source.url, snippet: source.snippet, publishedAt: source.publishedAt }));
    return res.json({ ...result, sessionId, quota, mode: "deep-research", citations });
  } catch (error) {
    if (controller.signal.aborted || res.destroyed) return;
    if (process.env.NODE_ENV !== "production") console.error("deep research failed", error);
    const message = error instanceof Error ? error.message : "deep research unavailable";
    if (/query is required|query is too long/i.test(message)) return res.status(400).json({ error: message });
    if (/quota exceeded/i.test(message)) return res.status(429).json({ error: message });
    return res.status(503).json({ error: "deep research unavailable" });
  } finally {
    req.off("aborted", onDisconnect);
    res.off("close", onDisconnect);
  }
});

export default router;
