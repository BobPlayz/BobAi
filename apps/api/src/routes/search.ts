import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, workspaceMembers } from "@bobai/db";
import { ensurePersonalWorkspace } from "../services/workspace.js";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUERY = 200;

async function workspaceFor(userId: string, requested?: string) {
  if (!requested) return ensurePersonalWorkspace(userId);
  if (!UUID.test(requested)) return null;
  const [member] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, requested), eq(workspaceMembers.userId, userId))).limit(1);
  return member ? { id: requested } : null;
}

router.get("/", async (req, res) => {
  const userId = req.user?.id;
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!userId) return res.status(401).json({ error: "authentication required" });
  if (!query || query.length > MAX_QUERY) return res.status(400).json({ error: "a search query up to 200 characters is required" });
  const workspace = await workspaceFor(userId, typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined);
  if (!workspace) return res.status(403).json({ error: "workspace access denied" });
  try {
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await db.execute(sql`
      SELECT * FROM (
        SELECT c.id, 'conversation' AS type, c.title AS title, NULL::text AS snippet, c.updated_at AS "updatedAt", c.is_pinned AS pinned
        FROM conversations c
        WHERE c.workspace_id = ${workspace.id} AND c.user_id = ${userId} AND c.is_archived = false
          AND (c.title ILIKE ${pattern} ESCAPE '\\')
        UNION ALL
        SELECT m.id, 'message' AS type, c.title AS title,
          LEFT(m.content, 300) AS snippet, m.created_at AS "updatedAt", c.is_pinned AS pinned
        FROM messages m
        INNER JOIN conversations c ON c.id = m.conversation_id
        WHERE c.workspace_id = ${workspace.id} AND c.user_id = ${userId} AND c.is_archived = false
          AND m.deleted_at IS NULL AND m.content ILIKE ${pattern} ESCAPE '\\'
        UNION ALL
        SELECT p.id, 'project' AS type, p.name AS title, LEFT(COALESCE(p.description, ''), 300) AS snippet, p.updated_at AS "updatedAt", false AS pinned
        FROM projects p
        WHERE p.workspace_id = ${workspace.id} AND p.owner_id = ${userId} AND p.archived = false
          AND (p.name ILIKE ${pattern} ESCAPE '\\' OR COALESCE(p.description, '') ILIKE ${pattern} ESCAPE '\\')
      ) results
      ORDER BY pinned DESC, "updatedAt" DESC
      LIMIT 50
    `;
    return res.json({ query, results: rows });
  } catch {
    return res.status(503).json({ error: "search temporarily unavailable" });
  }
});

export default router;
