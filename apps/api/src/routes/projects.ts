import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, projects, workspaceMembers } from "@bobai/db";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
type Req = { user?: { id: string }; body?: unknown; query: Record<string, unknown>; params: Record<string, string> };

async function workspaceFor(userId: string, requested?: string) {
  if (!requested) return ensurePersonalWorkspace(userId);
  if (!/^[0-9a-f-]{36}$/i.test(requested)) return null;
  const [member] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, requested), eq(workspaceMembers.userId, userId))).limit(1);
  return member ? { id: requested } : null;
}

function cleanProject(value: Record<string, unknown>) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim().slice(0, 2000) : "";
  const instructions = typeof value.instructions === "string" ? value.instructions.trim().slice(0, 12000) : "";
  return { name, description, instructions };
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "authentication required" });
    const body = req.query as Record<string, unknown>;
    const workspace = await workspaceFor(userId, typeof body.workspaceId === "string" ? body.workspaceId : undefined);
    if (!workspace) return res.status(403).json({ error: "workspace access denied" });
    const rows = await db.select().from(projects).where(and(eq(projects.workspaceId, workspace.id), eq(projects.ownerId, userId), eq(projects.archived, false))).orderBy(desc(projects.updatedAt));
    return res.json({ projects: rows });
  } catch { return res.status(503).json({ error: "project storage unavailable" }); }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "authentication required" });
    const input = cleanProject((req.body || {}) as Record<string, unknown>);
    if (!input.name || input.name.length > 200) return res.status(400).json({ error: "project name is required" });
    const workspace = await workspaceFor(userId, typeof (req.body as Record<string, unknown> | undefined)?.workspaceId === "string" ? String((req.body as Record<string, unknown>).workspaceId) : undefined);
    if (!workspace) return res.status(403).json({ error: "workspace access denied" });
    const [project] = await db.insert(projects).values({ workspaceId: workspace.id, ownerId: userId, name: input.name, description: input.description || null, settings: { instructions: input.instructions } }).returning();
    return res.status(201).json({ project });
  } catch { return res.status(503).json({ error: "project storage unavailable" }); }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id;
    if (!userId || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "valid project id is required" });
    const [existing] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.ownerId, userId), eq(projects.archived, false))).limit(1);
    if (!existing) return res.status(404).json({ error: "project not found" });
    const input = cleanProject({ ...existing, ...(req.body as Record<string, unknown>) });
    if (!input.name || input.name.length > 200) return res.status(400).json({ error: "project name is required" });
    const [project] = await db.update(projects).set({ name: input.name, description: input.description || null, settings: { ...(existing.settings && typeof existing.settings === "object" ? existing.settings : {}), instructions: input.instructions }, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return res.json({ project });
  } catch { return res.status(503).json({ error: "project storage unavailable" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id;
    if (!userId || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "valid project id is required" });
    const result = await db.update(projects).set({ archived: true, deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(projects.id, id), eq(projects.ownerId, userId))).returning({ id: projects.id });
    if (!result.length) return res.status(404).json({ error: "project not found" });
    return res.json({ success: true });
  } catch { return res.status(503).json({ error: "project storage unavailable" }); }
});

export default router;
