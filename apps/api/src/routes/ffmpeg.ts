import { Router } from "express";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { convertMedia, mediaStatus, probeMedia } from "../services/ffmpeg.js";
const router = Router();
const limit = createUserRateLimit(20, 60_000);
const decode = (value: unknown, maxBytes: number) => {
  if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4 + 16 || !/^[A-Za-z0-9+/\s]*={0,2}$/.test(value)) throw new Error("invalid base64 payload");
  const data = Buffer.from(value, "base64");
  if (!data.length || data.length > maxBytes) throw new Error("payload too large");
  return data;
};
router.get("/status", async (_req, res) => res.json(await mediaStatus()));
router.post("/probe", limit, async (req, res) => {
  try { return res.json({ metadata: await probeMedia(decode(req.body?.media, 32 * 1024 * 1024)) }); }
  catch (error) { const message = error instanceof Error ? error.message : "media probe failed"; return res.status(/invalid base64|payload too large/.test(message) ? 400 : 503).json({ error: message }); }
});
router.post("/convert", limit, async (req, res) => {
  try {
    const media = decode(req.body?.media, 32 * 1024 * 1024);
    const format = typeof req.body?.format === "string" ? req.body.format : "";
    return res.json(await convertMedia(media, format, req.body?.options));
  } catch (error) {
    const message = error instanceof Error ? error.message : "media conversion failed";
    return res.status(/invalid base64|payload too large|unsupported output format/.test(message) ? 400 : 503).json({ error: message });
  }
});
export default router;
