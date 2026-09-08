import { Router } from "express";
import { webSearch } from "../services/research.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const limit = createUserRateLimit(20, 60_000);

router.post("/search", limit, async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  const options = req.body?.options && typeof req.body.options === "object" && !Array.isArray(req.body.options) ? req.body.options as Record<string, unknown> : {};
  try {
    return res.json(await webSearch(query, options));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("research failed", error);
    const message = error instanceof Error ? error.message : "web search unavailable";
    if (/query is required|query is too long/i.test(message)) return res.status(400).json({ error: message });
    return res.status(503).json({ error: "web search unavailable" });
  }
});

export default router;
