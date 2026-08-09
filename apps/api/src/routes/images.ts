import { Router } from "express";

const router = Router();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.post("/generate", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const encoded = encodeURIComponent(prompt.trim());
  const images: { url: string; prompt: string }[] = [];

  // Generate 4 images SEQUENTIALLY to avoid Pollinations queue limits
  for (let i = 0; i < 4; i++) {
    images.push({
      url: `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=1024&height=1024&seed=${Date.now() + i * 9999}&nologo=true`,
      prompt,
    });

    // small delay so Pollinations doesn't reject the next request
    if (i < 3) {
      await sleep(1200);
    }
  }

  return res.json({ images });
});

export default router;