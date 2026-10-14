import { Router } from "express";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { analyzeImage } from "../services/vision.js";

const router = Router();
const limit = createUserRateLimit(20, 60_000);

router.post("/analyze", limit, async (req, res) => {
  const image = req.body?.image;
  const prompt = req.body?.prompt;

  if (typeof image !== "string" || !image.trim()) {
    return res.status(400).json({ error: "image is required" });
  }

  if (prompt !== undefined && typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt must be a string" });
  }

  const controller = new AbortController();
  const onDisconnect = () => { if (!res.writableEnded) controller.abort(new Error("client disconnected")); };
  req.once("aborted", onDisconnect);
  res.once("close", onDisconnect);
  try {
    const result = await analyzeImage(image, prompt, controller.signal);
    if (controller.signal.aborted || res.destroyed) return;
    return res.json(result);
  } catch (error) {
    if (controller.signal.aborted || res.destroyed) return;
    if (process.env.NODE_ENV !== "production") console.error("VISION ROUTE ERROR:", error);
    const message = error instanceof Error ? error.message : "vision analysis failed";
    const clientError = /is required|must be|too long|exceeds|invalid image|only valid|MIME does not match|format is unsupported|only PNG|base64 data/i.test(message);
    return res.status(clientError ? 400 : 502).json({ error: clientError ? message : "vision analysis unavailable" });
  } finally {
    req.off("aborted", onDisconnect);
    res.off("close", onDisconnect);
  }
});

export default router;
