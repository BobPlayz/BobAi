import { Router } from "express";
import { webSearch } from "../services/research.js";

const router = Router();

router.post("/search", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  const options = req.body?.options && typeof req.body.options === "object" && !Array.isArray(req.body.options) ? req.body.options as Record<string, unknown> : {};
  try {
    return res.json(await webSearch(query, options));
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "web search unavailable" });
  }
});

export default router;
