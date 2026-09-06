import { randomUUID } from "node:crypto";
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
const approvalRequired = new Set<ProviderCapability>([
  "image_upscale", "background_removal", "object_removal", "image_editing", "video_generation", "image_to_video",
  "talking_image", "talking_avatar", "face_swap", "voice_synthesis", "music_generation", "diagram_generation", "sketch_to_ui",
]);
const approvals = new Map<string, { userId: string; capability: ProviderCapability; expiresAt: number }>();
const APPROVAL_TTL_MS = 60_000;
const isSupported = (value: string): value is ProviderCapability => supported.has(value as ProviderCapability);
function isObjectBody(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validateCapabilityInput(capability: ProviderCapability, body: Record<string, unknown>) { if (capability === "face_swap" && body.consent !== true) return "explicit consent is required for face-swap operations"; return null; }
function consumeApproval(userId: string, capability: ProviderCapability, token: unknown) {
  if (!approvalRequired.has(capability)) return true;
  if (typeof token !== "string") return false;
  const approval = approvals.get(token);
  if (!approval || approval.userId !== userId || approval.capability !== capability || approval.expiresAt <= Date.now()) { approvals.delete(token); return false; }
  approvals.delete(token); return true;
}
function providerInput(body: Record<string, unknown>) { const { approvalToken: _approvalToken, ...input } = body; return input; }
setInterval(() => { const now = Date.now(); for (const [token, approval] of approvals) if (approval.expiresAt <= now) approvals.delete(token); }, APPROVAL_TTL_MS).unref();

router.get("/", (_req, res) => res.json({ capabilities: listProviderCapabilities() }));
router.post("/:capability/approve", (req, res) => {
  const capability = req.params.capability;
  if (!isSupported(capability)) return res.status(404).json({ error: "capability not found" });
  if (!approvalRequired.has(capability)) return res.json({ approvalRequired: false });
  const token = randomUUID();
  approvals.set(token, { userId: req.user!.id, capability, expiresAt: Date.now() + APPROVAL_TTL_MS });
  return res.json({ approvalRequired: true, approvalToken: token, expiresInSeconds: APPROVAL_TTL_MS / 1000 });
});
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
  if (!consumeApproval(req.user!.id, capability, req.body.approvalToken)) return res.status(409).json({ error: "user approval is required" });
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const job = await createCapabilityJob(capability, providerInput(req.body), { workspaceId: workspace.id, createdBy: req.user!.id });
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
  if (!consumeApproval(req.user!.id, capability, req.body.approvalToken)) return res.status(409).json({ error: "user approval is required" });
  try {
    const result = await executeProviderCapability(capability, providerInput(req.body));
    return res.json({ capability, result });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(`capability ${capability} failed`, error);
    return res.status(503).json({ error: "capability provider unavailable", capability });
  }
});
export default router;
