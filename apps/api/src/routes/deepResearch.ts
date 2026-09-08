import { Router } from "express";
import { deepResearch } from "../services/deepResearch.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const limit = createUserRateLimit(4, 60_000);

router.post("/", limit, async (req, res) => {
  try {
    const result = await deepResearch(req.body?.query);
    return res.json({ ...result, mode: "deep-research" });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("deep research failed", error);
    const message = error instanceof Error ? error.message : "deep research unavailable";
    if (/query is required|query is too long/i.test(message)) return res.status(400).json({ error: message });
    return res.status(503).json({ error: "deep research unavailable" });
  }
});

export default router;
