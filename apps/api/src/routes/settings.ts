import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, settings } from "@bobai/db";
import { ensurePersonalWorkspace } from "../services/workspace.js";
const router = Router();
const SAFE_KEYS = new Set(["personality", "model", "memoryEnabled", "theme", "language", "responseStyle", "notifications", "voice", "privacy", "modelTraining"]);
const MAX_VALUE_BYTES = 16_000;

router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "authentication required" });
    const workspace = await ensurePersonalWorkspace(userId);
    const rows = await db.select({ key: settings.key, value: settings.value, category: settings.category, updatedAt: settings.updatedAt }).from(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspace.id)));
    return res.json({ settings: Object.fromEntries(rows.map((row) => [row.key, row.value])), updatedAt: rows.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, new Date(0)).toISOString() });
  } catch { return res.status(503).json({ error: "settings unavailable" }); }
});

router.put("/:key", async (req, res) => {
  try {
    const userId = req.user?.id;
    const key = req.params.key as string;
    if (!userId || !SAFE_KEYS.has(key)) return res.status(400).json({ error: "unsupported setting" });
    const value = (req.body as Record<string, unknown> | undefined)?.value;
    if (value === undefined) return res.status(400).json({ error: "value is required" });
    const encoded = JSON.stringify(value);
    if (encoded.length > MAX_VALUE_BYTES) return res.status(413).json({ error: "setting is too large" });
    if (key === "modelTraining") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return res.status(400).json({ error: "invalid model training setting" });
      const training = value as Record<string, unknown>;
      if (typeof training.optIn !== "boolean") return res.status(400).json({ error: "model training opt-in must be explicit" });
      if (training.scope !== undefined && training.scope !== "preferences-and-conversations") return res.status(400).json({ error: "unsupported training scope" });
    }
    const workspace = await ensurePersonalWorkspace(userId);
    const row = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`setting:${userId}:${workspace.id}:${key}`}))`);
      const [existing] = await tx.select({ id: settings.id }).from(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspace.id), eq(settings.key, key))).limit(1);
      if (existing) {
        const [updated] = await tx.update(settings).set({ value, updatedAt: new Date(), category: key === "modelTraining" ? "privacy" : "user" }).where(eq(settings.id, existing.id)).returning({ key: settings.key, value: settings.value });
        return updated;
      }
      const [created] = await tx.insert(settings).values({ userId, workspaceId: workspace.id, key, value, category: key === "modelTraining" ? "privacy" : "user" }).returning({ key: settings.key, value: settings.value });
      return created;
    });
    return res.json({ setting: row });
  } catch { return res.status(503).json({ error: "settings update unavailable" }); }
});

router.delete("/:key", async (req, res) => {
  try {
    const userId = req.user?.id;
    const key = req.params.key as string;
    if (!userId || !SAFE_KEYS.has(key)) return res.status(400).json({ error: "unsupported setting" });
    const workspace = await ensurePersonalWorkspace(userId);
    await db.delete(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspace.id), eq(settings.key, key)));
    return res.json({ success: true });
  } catch { return res.status(503).json({ error: "settings deletion unavailable" }); }
});
export default router;
