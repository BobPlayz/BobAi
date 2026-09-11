import { Router } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, images } from "@bobai/db";
import { generateImages } from "../services/mediaGeneration.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router(); const limit = createUserRateLimit(10, 60_000);
router.get("/", async (req, res) => { try { const workspace = await ensurePersonalWorkspace(req.user!.id); const rows = await db.select().from(images).where(and(eq(images.workspaceId, workspace.id), eq(images.createdBy, req.user!.id), isNull(images.deletedAt))).orderBy(desc(images.createdAt)).limit(100); return res.json({ images: rows }); } catch { return res.status(503).json({ error: "media history unavailable" }); } });
router.post("/generate", limit, async (req, res) => { const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : ""; const count = typeof req.body?.count === "number" ? req.body.count : 4; if (!prompt) return res.status(400).json({ error: "prompt is required" }); if (!Number.isInteger(count) || count < 1 || count > 4) return res.status(400).json({ error: "count must be an integer from 1 to 4" }); try { const workspace = await ensurePersonalWorkspace(req.user!.id); const generated = await generateImages(prompt, count); const persisted = []; for (const image of generated) { const [row] = await db.insert(images).values({ id: randomUUID(), workspaceId: workspace.id, createdBy: req.user!.id, prompt: image.prompt, operation: "generate", metadata: { url: image.url, index: image.index } }).returning(); if (row) persisted.push({ ...row, url: image.url }); } return res.json({ images: persisted }); } catch { return res.status(502).json({ error: "image generation failed" }); } });
router.delete("/:id", async (req, res) => { try { const workspace = await ensurePersonalWorkspace(req.user!.id); const [row] = await db.update(images).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(images.id, req.params.id), eq(images.workspaceId, workspace.id), eq(images.createdBy, req.user!.id), isNull(images.deletedAt))).returning({ id: images.id }); return row ? res.json({ success: true }) : res.status(404).json({ error: "image not found" }); } catch { return res.status(503).json({ error: "media deletion unavailable" }); } });
export default router;
