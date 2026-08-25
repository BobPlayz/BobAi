import { Router } from "express";
import { generateImages } from "../services/mediaGeneration.js";

const router = Router();

router.post("/generate", async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  try {
    return res.json({ images: await generateImages(prompt) });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "image generation failed",
    });
  }
});

export default router;
