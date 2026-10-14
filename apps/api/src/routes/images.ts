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
  if (!prompt || prompt.length > MAX_PROMPT) return res.status(400).json({ error: "image prompt must be 1-8000 characters" });
  if (!Number.isInteger(count) || count < 1 || count > 4) return res.status(400).json({ error: "count must be between 1 and 4" });
  if (!Number.isInteger(width) || width < 256 || width > 768 || width % 8 !== 0 || !Number.isInteger(height) || height < 256 || height > 768 || height % 8 !== 0) return res.status(400).json({ error: "width and height must be multiples of 8 between 256 and 768" });
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295)) return res.status(400).json({ error: "seed must be an integer between 0 and 4294967295" });
  const inputImages = Array.isArray(req.body?.inputImages) ? req.body.inputImages as string[] : undefined;

  try {
    const generated = await generateImages(prompt, count, inputImages, undefined, { width, height, ...(seed === undefined ? {} : { seed }) });
    if (!generated.length || generated.length > count) throw new Error("local image generation returned no images");
    for (const item of generated) {
      if (typeof item.url !== "string" || item.url.length > MAX_DATA_URL || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(item.url)) {
        throw new Error("local image generation returned an invalid image");
      }
    }

    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const created = await db.insert(images).values(generated.map((item) => ({
      workspaceId: workspace.id,
      createdBy: req.user!.id,
      prompt,
      model: process.env.BOBAI_IMAGE_MODEL_PATH ? "local-diffusers" : "unconfigured",
      width: item.width ?? width,
      height: item.height ?? height,
      seed: item.seed ?? seed ?? null,
      operation: "generate",
      metadata: { url: item.url, index: item.index, source: "local" },
    }))).returning();

    const response = { images: created.map((row, index) => ({ ...row, url: generated[index].url, prompt })) };
    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safeMessage = /^(image prompt.{0,100}|count must be.{0,100}|local image.{0,200}|image generation is unavailable.{0,100}|up to 4 input images are supported|reference images.{0,100})$/i.test(message)
      ? message
      : "local image generation failed; check the local model setup and API logs";
    return res.status(502).json({ error: safeMessage });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const workspace = await ensurePersonalWorkspace(req.user!.id);
    const [row] = await db.select().from(images)
      .where(and(eq(images.id, req.params.id), eq(images.workspaceId, workspace.id), eq(images.createdBy, req.user!.id), isNull(images.deletedAt)))
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
