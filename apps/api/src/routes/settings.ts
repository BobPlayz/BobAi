import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, settings } from "@bobai/db";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
const SAFE_KEYS = new Set(["personality", "model", "memoryEnabled", "theme", "language", "responseStyle", "notifications", "voice", "privacy"]);
const MAX_VALUE_BYTES = 16_000;

router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id; if (!userId) return res.status(401).json({ error: "authentication required" });
    const workspace = await ensurePersonalWorkspace(userId);
    const rows = await db.select({ key: settings.key, value: settings.value, category: settings.category, updatedAt: settings.updatedAt }).from(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspace.id)));
    return res.json({ settings: Object.fromEntries(rows.map((row) => [row.key, row.value])), updatedAt: rows.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, new Date(0)).toISOString() });
  } catch { return res.status(503).json({ error: "settings unavailable" }); }
});

router.put("/:key", async (req, res) => {
  try {
    const userId = req.user?.id; const key = req.params.key as string;
    if (!userId || !SAFE_KEYS.has(key)) return res.status(400).json({ error: "unsupported setting" });
    const value = (req.body as Record<string, unknown> | undefined)?.value;
    if (value === undefined) return res.status(400).json({ error: "value is required" });
    const encoded = JSON.stringify(value); if (encoded.length > MAX_VALUE_BYTES) return res.status(413).json({ error: "setting is too large" });
    const workspace = await ensurePersonalWorkspace(userId);
    const [row] = await db.insert(settings).values({ userId, workspaceId: workspace.id, key, value, category: "user" }).onConflictDoNothing().returning();
    if (!row) { const [updated] = await db.update(settings).set({ value, updatedAt: new Date() }).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspace.id), eq(settings.key, key))).returning({ key: settings.key, value: settings.value }); return res.json({ setting: updated }); }
    return res.status(201).json({ setting: { key: row.key, value: row.value } });
  } catch { return res.status(503).json({ error: "settings update unavailable" }); }
});

router.delete("/:key", async (req, res) => { try { const userId = req.user?.id; const key = req.params.key as string; if (!userId || !SAFE_KEYS.has(key)) return res.status(400).json({ error: "unsupported setting" }); const workspace = await ensurePersonalWorkspace(userId); await db.delete(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspace.id), eq(settings.key, key))); return res.json({ success: true }); } catch { return res.status(503).json({ error: "settings deletion unavailable" }); } });
export default router;
