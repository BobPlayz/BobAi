import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, settings } from "@bobai/db";
import { ensurePersonalWorkspace } from "../services/workspace.js";
const router = Router();
const SAFE_KEYS = new Set(["personality", "model", "memoryEnabled", "theme", "language", "responseStyle", "responseLength", "tone", "defaultModel", "defaultToolPermissions", "customInstructions", "promptTemplates", "notifications", "voice", "privacy", "modelTraining", "accessibility"]);
const MAX_VALUE_BYTES = 16_000;
const THEMES = new Set(["dark", "light", "futuristic", "anime"]);
const RESPONSE_LENGTHS = new Set(["short", "balanced", "long"]);
const TONES = new Set(["natural", "friendly", "professional", "concise", "technical"]);

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function validateSetting(key: string, value: unknown): string | null {
  if (key === "memoryEnabled") return typeof value === "boolean" ? null : "memoryEnabled must be boolean";
  if (["personality", "model", "language", "responseStyle", "responseLength", "tone", "defaultModel", "customInstructions"].includes(key) && typeof value !== "string") return `${key} must be a string`;
  if (key === "theme" && (typeof value !== "string" || !THEMES.has(value))) return "unsupported theme";
  if (key === "responseLength" && (typeof value !== "string" || !RESPONSE_LENGTHS.has(value))) return "unsupported response length";
  if (key === "tone" && (typeof value !== "string" || !TONES.has(value))) return "unsupported tone";
  if (key === "defaultToolPermissions") {
    if (!Array.isArray(value) || value.length > 50 || value.some((item) => typeof item !== "string" || item.length > 100)) return "default tool permissions must be a string array";
  }
  if (key === "promptTemplates" && (!Array.isArray(value) || value.length > 100 || value.some((item) => !isRecord(item) || typeof item.name !== "string" || typeof item.prompt !== "string"))) return "invalid prompt templates";
  if (key === "accessibility" && !isRecord(value)) return "accessibility must be an object";
  if (key === "modelTraining") {
    if (!isRecord(value) || typeof value.optIn !== "boolean") return "model training opt-in must be explicit";
    if (value.scope !== undefined && value.scope !== "preferences-and-conversations") return "unsupported training scope";
  }
  return null;
}

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
    const encoded = JSON.stringify(value);
    if (encoded.length > MAX_VALUE_BYTES) return res.status(413).json({ error: "setting is too large" });
    const validationError = validateSetting(key, value); if (validationError) return res.status(400).json({ error: validationError });
    const workspace = await ensurePersonalWorkspace(userId);
    const row = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`setting:${userId}:${workspace.id}:${key}`}))`);
      const [existing] = await tx.select({ id: settings.id }).from(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspace.id), eq(settings.key, key))).limit(1);
      const category = key === "modelTraining" ? "privacy" : key === "accessibility" ? "accessibility" : "user";
      if (existing) return (await tx.update(settings).set({ value, updatedAt: new Date(), category }).where(eq(settings.id, existing.id)).returning({ key: settings.key, value: settings.value }))[0];
      return (await tx.insert(settings).values({ userId, workspaceId: workspace.id, key, value, category }).returning({ key: settings.key, value: settings.value }))[0];
    });
    return res.json({ setting: row });
  } catch { return res.status(503).json({ error: "settings update unavailable" }); }
});

router.delete("/:key", async (req, res) => {
  try {
    const userId = req.user?.id; const key = req.params.key as string;
    if (!userId || !SAFE_KEYS.has(key)) return res.status(400).json({ error: "unsupported setting" });
    const workspace = await ensurePersonalWorkspace(userId);
    await db.delete(settings).where(and(eq(settings.userId, userId), eq(settings.workspaceId, workspace.id), eq(settings.key, key)));
    return res.json({ success: true });
  } catch { return res.status(503).json({ error: "settings deletion unavailable" }); }
});
export default router;
