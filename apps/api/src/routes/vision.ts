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
    const status = /not configured|is required|too long|exceeds/i.test(message) ? 400 : 502;
    return res.status(status).json({ error: message });
  }
});

export default router;
