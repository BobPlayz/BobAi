import { Router } from "express";
import { generateImages } from "../services/mediaGeneration.js";

const router = Router();

router.post("/generate", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const count = typeof req.body?.count === "number" ? req.body.count : 4;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (!Number.isInteger(count) || count < 1 || count > 4) return res.status(400).json({ error: "count must be an integer from 1 to 4" });

  try {
    return res.json({ images: await generateImages(prompt, count) });
  } catch {
    return res.status(502).json({ error: "image generation failed" });
  }
});

export default router;
