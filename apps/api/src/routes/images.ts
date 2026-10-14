import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, images } from "@bobai/db";
import { generateImages } from "../services/mediaGeneration.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
const limit = createUserRateLimit(5, 60_000);
const MAX_PROMPT = 8_000;
const MAX_DATA_URL = 12 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get("/", async (req, res) => {
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const rows = await db.select().from(images)
      .where(and(eq(images.workspaceId, workspace.id), eq(images.createdBy, req.user!.id), isNull(images.deletedAt)))
      .orderBy(desc(images.createdAt)).limit(100);
    return res.json({ images: rows });
  } catch {
    return res.status(503).json({ error: "media history unavailable" });
  }
});

router.post("/generate", limit, async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const count = typeof req.body?.count === "number" ? req.body.count : 1;
  const width = typeof req.body?.width === "number" ? req.body.width : 512;
  const height = typeof req.body?.height === "number" ? req.body.height : 512;
  const seed = req.body?.seed;
  const steps = req.body?.steps === undefined ? 24 : req.body.steps;
  const guidanceScale = req.body?.guidanceScale === undefined ? 7 : req.body.guidanceScale;
  const negativePrompt = req.body?.negativePrompt === undefined ? "" : req.body.negativePrompt;
  if (!prompt || prompt.length > MAX_PROMPT) return res.status(400).json({ error: "image prompt must be 1-8000 characters" });
  if (!Number.isInteger(count) || count < 1 || count > 4) return res.status(400).json({ error: "count must be between 1 and 4" });
  if (!Number.isInteger(width) || width < 256 || width > 768 || width % 8 !== 0 || !Number.isInteger(height) || height < 256 || height > 768 || height % 8 !== 0) return res.status(400).json({ error: "width and height must be multiples of 8 between 256 and 768" });
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 2_147_483_647)) return res.status(400).json({ error: "seed must be an integer between 0 and 2147483647" });
  if (!Number.isInteger(steps) || steps < 10 || steps > 50) return res.status(400).json({ error: "steps must be an integer between 10 and 50" });
  if (typeof guidanceScale !== "number" || !Number.isFinite(guidanceScale) || guidanceScale < 1 || guidanceScale > 15) return res.status(400).json({ error: "guidanceScale must be a number between 1 and 15" });
  if (typeof negativePrompt !== "string" || negativePrompt.length > 2_000) return res.status(400).json({ error: "negativePrompt must be text under 2000 characters" });
  if (req.body?.inputImages !== undefined && (!Array.isArray(req.body.inputImages) || req.body.inputImages.length > 4 || req.body.inputImages.some((image: unknown) => typeof image !== "string"))) return res.status(400).json({ error: "inputImages must be an array of up to 4 reference images" });
  const inputImages = req.body?.inputImages as string[] | undefined;
  const controller = new AbortController();
  const onDisconnect = () => { if (!res.writableEnded && !res.destroyed) controller.abort(new Error("client disconnected")); };
  req.once("aborted", onDisconnect);
  res.once("close", onDisconnect);

  try {
    const generated = await generateImages(prompt, count, inputImages, controller.signal, { width, height, steps, guidanceScale, negativePrompt, ...(seed === undefined ? {} : { seed }) });
    if (controller.signal.aborted || res.destroyed) return;
    if (!generated.length || generated.length > count) throw new Error("local image generation returned no images");
    for (const item of generated) {
      if (typeof item.url !== "string" || item.url.length > MAX_DATA_URL || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(item.url)) {
        throw new Error("local image generation returned an invalid image");
      }
    }

    const workspace = await ensurePersonalWorkspace(req.user!.id);
    if (controller.signal.aborted || res.destroyed) return;
    const created = await db.insert(images).values(generated.map((item) => ({
      workspaceId: workspace.id,
      createdBy: req.user!.id,
      prompt,
      model: process.env.BOBAI_IMAGE_MODEL_PATH ? "local-diffusers" : "unconfigured",
      width: item.width ?? width,
      height: item.height ?? height,
      seed: item.seed ?? seed ?? null,
      operation: inputImages?.length ? "edit" : "generate",
      metadata: { url: item.url, index: item.index, source: "local" },
    }))).returning();

    const response = { images: created.map((row, index) => ({ ...row, url: generated[index].url, prompt })) };
    return res.json(response);
  } catch (error) {
    if (controller.signal.aborted || res.destroyed) return;
    const message = error instanceof Error ? error.message : "";
    const clientError = /^(image prompt.{0,100}|count must be.{0,100}|width and height.{0,100}|seed must be.{0,100}|steps must be.{0,100}|guidanceScale must be.{0,100}|negativePrompt must be.{0,100}|local image editing is not configured.{0,100}|up to 4 input images are supported|reference images.{0,100}|MIME does not match.{0,100}|media request violates the safety policy|image request exceeds the 12 MB limit)$/i.test(message);
    const safeMessage = clientError ? message : "local image generation failed; check the local model setup and API logs";
    return res.status(clientError ? 400 : 502).json({ error: safeMessage });
  } finally {
    req.off("aborted", onDisconnect);
    res.off("close", onDisconnect);
  }
});

router.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  if (!UUID.test(id)) return res.status(400).json({ error: "invalid image id" });
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const [row] = await db.select().from(images)
      .where(and(eq(images.id, id), eq(images.workspaceId, workspace.id), eq(images.createdBy, req.user!.id), isNull(images.deletedAt)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "image not found" });
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown> : {};
    const url = typeof metadata.url === "string" ? metadata.url : null;
    if (!url) return res.status(410).json({ error: "image data is unavailable" });
    const safeMetadata = { ...metadata };
    delete safeMetadata.url;
    return res.json({ image: { ...row, metadata: safeMetadata, url } });
  } catch {
    return res.status(503).json({ error: "image retrieval unavailable" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  if (!UUID.test(id)) return res.status(400).json({ error: "invalid image id" });
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const [row] = await db.update(images).set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(images.id, req.params.id), eq(images.workspaceId, workspace.id), eq(images.createdBy, req.user!.id), isNull(images.deletedAt)))
      .returning({ id: images.id });
    return row ? res.json({ success: true }) : res.status(404).json({ error: "image not found" });
  } catch {
    return res.status(503).json({ error: "media deletion unavailable" });
  }
});

export default router;
