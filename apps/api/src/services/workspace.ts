import { and, eq, sql } from "drizzle-orm";
import { db, users, workspaceMembers, workspaces } from "@bobai/db";

const workspaceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function ensurePersonalWorkspace(userId: string, username?: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);

    const existing = await tx.select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(and(eq(workspaces.ownerId, userId), eq(workspaces.type, "personal"), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (existing[0]) return existing[0];

    const [user] = username ? [{ username }] : await tx.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
    const name = `${user?.username || "user"}'s BobAI`;
    const [workspace] = await tx.insert(workspaces).values({ ownerId: userId, name, type: "personal" }).returning({ id: workspaces.id, name: workspaces.name });
    if (!workspace) throw new Error("personal workspace creation failed");
    await tx.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: "owner" });
    return workspace;
  });
}

export async function resolveUserWorkspace(userId: string, requestedWorkspaceId?: string) {
  const requested = requestedWorkspaceId?.trim() || "";
  if (!requested) return ensurePersonalWorkspace(userId);
  if (!workspaceIdPattern.test(requested)) return null;
  const [membership] = await db.select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, requested), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return membership ? { id: requested, name: "" } : null;
}

export function isWorkspaceId(value: string) {
  return workspaceIdPattern.test(value);
}
