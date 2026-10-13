import { and, eq, lte, ne } from "drizzle-orm";
import { db, users, workspaces } from "@bobai/db";
import { purgeUserOwnedData } from "./accountPurge.js";

const RETENTION_DAYS = 30;
let running = false;

export async function runAccountDeletionCleanup() {
  if (running) return;
  running = true;
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await db.select({ id: users.id }).from(users).where(lte(users.deletedAt, cutoff));
    for (const candidate of candidates) {
      const sharedOwned = await db.select({ id: workspaces.id }).from(workspaces)
        .where(and(eq(workspaces.ownerId, candidate.id), ne(workspaces.type, "personal"))).limit(1);
      if (sharedOwned.length) {
        console.warn("[account-deletion] skipped a user who still owns a shared workspace");
        continue;
      }
      try {
        await purgeUserOwnedData(candidate.id);
      } catch (error) {
        console.error("[account-deletion] permanent deletion failed", error instanceof Error ? error.message : "unknown error");
      }
    }
  } finally {
    running = false;
  }
}
