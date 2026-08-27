import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { apiKeys, db, workspaceMembers } from "@bobai/db";

const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const makeKey = () => `bob_${randomBytes(32).toString("base64url")}`;

async function member(userId: string, workspaceId: string) {
  const [row] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(
    eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)
  )).limit(1);
  return Boolean(row);
}

export async function createApiKey(userId: string, workspaceId: string, name: string, permissions?: unknown, expiresAt?: Date) {
  if (!await member(userId, workspaceId)) return null;
  const key = makeKey();
  const prefix = key.slice(0, 12);
  const [row] = await db.insert(apiKeys).values({
    workspaceId,
    createdBy: userId,
    name,
    hashedKey: hash(key),
    prefix,
    permissions: permissions ?? null,
    expiresAt: expiresAt ?? null
  }).returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, expiresAt: apiKeys.expiresAt, createdAt: apiKeys.createdAt });
  return row ? { ...row, key } : null;
}

export async function listApiKeys(userId: string, workspaceId: string) {
  if (!await member(userId, workspaceId)) return null;
  return db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, permissions: apiKeys.permissions, lastUsedAt: apiKeys.lastUsedAt, expiresAt: apiKeys.expiresAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(and(
    eq(apiKeys.workspaceId, workspaceId), isNull(apiKeys.revokedAt)
  ));
}

export async function revokeApiKey(userId: string, workspaceId: string, id: string) {
  if (!await member(userId, workspaceId)) return false;
  const [row] = await db.update(apiKeys).set({ revokedAt: new Date(), isActive: false, updatedAt: new Date() }).where(and(
    eq(apiKeys.id, id), eq(apiKeys.workspaceId, workspaceId), isNull(apiKeys.revokedAt)
  )).returning({ id: apiKeys.id });
  return Boolean(row);
}

export async function authenticateApiKey(key: string) {
  const [row] = await db.select().from(apiKeys).where(and(
    eq(apiKeys.hashedKey, hash(key)), eq(apiKeys.isActive, true), isNull(apiKeys.revokedAt),
    gt(apiKeys.expiresAt, new Date())
  )).limit(1);
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date(), updatedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return row;
}
