import { Router } from "express";

const router = Router();

router.post("/generate", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({
      error: "prompt is required",
    });
  }

  // temporary placeholder until we wire ComfyUI / FLUX
  const seed = encodeURIComponent(prompt.trim());

  return res.json({
    images: [
      {
        url: `https://picsum.photos/seed/${seed}/1024/1024`,
        prompt,
      },
      {
        url: `https://picsum.photos/seed/${seed}-2/1024/1024`,
        prompt,
      },
    ],
  });
});

export default router;