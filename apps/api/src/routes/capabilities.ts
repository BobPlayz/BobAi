import { Router } from "express";
import { executeProviderCapability, listProviderCapabilities, type ProviderCapability } from "../services/capabilityProviders.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";
import { createCapabilityJob, getActiveCapabilityJob, getPersistedCapabilityJob } from "../services/capabilityJobs.js";

const router = Router();
const supported = new Set<ProviderCapability>([
  "image_upscale", "background_removal", "object_removal", "image_editing", "video_generation", "image_to_video",
  "talking_image", "talking_avatar", "face_swap", "short_clip_finder", "voice_synthesis", "speech_to_text",
  "meeting_transcription", "music_generation", "music_discovery", "diagram_generation", "sketch_to_ui",
]);
const isSupported = (value: string): value is ProviderCapability => supported.has(value as ProviderCapability);
function isObjectBody(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validateCapabilityInput(capability: ProviderCapability, body: Record<string, unknown>) {
  if (capability === "face_swap" && body.consent !== true) return "explicit consent is required for face-swap operations";
  return null;
}

router.get("/", (_req, res) => res.json({ capabilities: listProviderCapabilities() }));
router.get("/jobs/:id", async (req, res) => {
  const active = getActiveCapabilityJob(req.params.id, req.user!.id);
  if (active) return res.json({ job: active });
  const persisted = await getPersistedCapabilityJob(req.params.id, req.user!.id);
  if (!persisted) return res.status(404).json({ error: "capability job not found" });
  return res.json({ job: persisted });
});
router.post("/:capability/jobs", async (req, res) => {
  const capability = req.params.capability;
  if (!isSupported(capability)) return res.status(404).json({ error: "capability not found" });
  if (!isObjectBody(req.body)) return res.status(400).json({ error: "request body must be a JSON object" });
  const validationError = validateCapabilityInput(capability, req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const job = await createCapabilityJob(capability, req.body, { workspaceId: workspace.id, createdBy: req.user!.id });
    return res.status(202).json({ job });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(`capability job ${capability} failed`, error);
    return res.status(503).json({ error: "capability job could not be created", capability });
  }
});
router.post("/:capability", async (req, res) => {
  const capability = req.params.capability;
  if (!isSupported(capability)) return res.status(404).json({ error: "capability not found" });
  if (!isObjectBody(req.body)) return res.status(400).json({ error: "request body must be a JSON object" });
  const validationError = validateCapabilityInput(capability, req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  try {
    const result = await executeProviderCapability(capability, req.body);
    return res.json({ capability, result });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(`capability ${capability} failed`, error);
    return res.status(503).json({ error: "capability provider unavailable", capability });
  }
});
export default router;
