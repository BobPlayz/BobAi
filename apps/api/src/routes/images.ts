import { Router } from "express";
import { generateImages } from "../services/imageService.js";

const router = Router();

router.post("/generate", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({
      error: "prompt is required",
    });
  }

  const images = await generateImages(prompt);

  return res.json({
    images,
  });
});

export default router;