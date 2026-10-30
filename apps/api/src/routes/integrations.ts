import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, integrations } from "@bobai/db";
import { resolveUserWorkspace } from "../services/workspace.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";

const router = Router();
const limit = createUserRateLimit(20, 60_000);

router.get("/", limit, async (req, res) => {
  try {
    const workspace = await resolveUserWorkspace(req.user!.id);
    if (!workspace) return res.status(403).json({ error: "workspace access denied" });
    const rows = await db.select({ id: integrations.id, provider: integrations.provider, displayName: integrations.displayName, scopes: integrations.scopes, createdAt: integrations.createdAt, updatedAt: integrations.updatedAt }).from(integrations).where(and(eq(integrations.workspaceId, workspace.id), eq(integrations.isEnabled, true), isNull(integrations.deletedAt)));
    return res.json({ integrations: rows });
  } catch { return res.status(503).json({ error: "could not load connected apps" }); }
});

router.delete("/:id", limit, async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  try {
    const workspace = await resolveUserWorkspace(req.user!.id);
    if (!workspace) return res.status(403).json({ error: "workspace access denied" });
    const [row] = await db.update(integrations).set({ isEnabled: false, deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(integrations.id, id), eq(integrations.workspaceId, workspace.id), eq(integrations.createdBy, req.user!.id), isNull(integrations.deletedAt))).returning({ id: integrations.id });
    return row ? res.json({ disconnected: true }) : res.status(404).json({ error: "connected app not found" });
  } catch { return res.status(503).json({ error: "could not disconnect app" }); }
});

export default router;
