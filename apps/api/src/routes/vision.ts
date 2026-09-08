import { Router } from "express";
import { analyzeImage } from "../services/vision.js";

const router = Router();

router.post("/analyze", async (req, res) => {
  const image = req.body?.image;
  const prompt = req.body?.prompt;

  if (typeof image !== "string" || !image.trim()) {
    return res.status(400).json({ error: "image is required" });
  }

  if (prompt !== undefined && typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt must be a string" });
  }

  try {
    const result = await analyzeImage(image, prompt);
    return res.json(result);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("VISION ROUTE ERROR:", error);
    const message = error instanceof Error ? error.message : "vision analysis failed";
    const clientError = /is required|must be|too long|exceeds/i.test(message);
    return res.status(clientError ? 400 : 502).json({ error: clientError ? message : "vision analysis unavailable" });
  }
});

export default router;
