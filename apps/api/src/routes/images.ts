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
  if (!prompt || prompt.length > MAX_PROMPT) return res.status(400).json({ error: "image prompt must be 1-8000 characters" });
  if (!Number.isInteger(count) || count < 1 || count > 4) return res.status(400).json({ error: "count must be between 1 and 4" });

  try {
    const generated = await generateImages(prompt, count);
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
      width: 512,
      height: 512,
      seed: null,
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
