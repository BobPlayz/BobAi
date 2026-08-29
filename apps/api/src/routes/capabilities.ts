import { Router } from "express";
import {
  executeProviderCapability,
  listProviderCapabilities,
  type ProviderCapability,
} from "../services/capabilityProviders.js";

const router = Router();

const supported = new Set<ProviderCapability>([
  "image_upscale",
  "background_removal",
  "object_removal",
  "image_editing",
  "video_generation",
  "image_to_video",
  "talking_image",
  "talking_avatar",
  "face_swap",
  "short_clip_finder",
  "voice_synthesis",
  "speech_to_text",
  "meeting_transcription",
  "music_generation",
  "music_discovery",
  "diagram_generation",
  "sketch_to_ui",
]);

router.get("/", (_req, res) => res.json({ capabilities: listProviderCapabilities() }));

router.post("/:capability", async (req, res) => {
  const capability = req.params.capability as ProviderCapability;
  if (!supported.has(capability)) return res.status(404).json({ error: "capability not found" });

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "request body must be a JSON object" });
  }

  try {
    const result = await executeProviderCapability(capability, req.body as Record<string, unknown>);
    return res.json({ capability, result });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(`capability ${capability} failed`, error);
    return res.status(503).json({ error: "capability provider unavailable", capability });
  }
});

export default router;
