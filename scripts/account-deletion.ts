import { and, eq, lte, ne } from "drizzle-orm";
import { db, users, workspaces } from "@bobai/db";

const RETENTION_DAYS = 30;
const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

async function main() {
  const candidates = await db.select({ id: users.id, email: users.email }).from(users).where(lte(users.deletedAt, cutoff));
  let deleted = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const sharedOwned = await db.select({ id: workspaces.id }).from(workspaces).where(and(eq(workspaces.ownerId, candidate.id), ne(workspaces.type, "personal"))).limit(1);
    if (sharedOwned.length) {
      skipped += 1;
      console.warn(`[account-deletion] skipped ${candidate.id}: user still owns a non-personal workspace`);
      continue;
    }

    try {
      await db.transaction(async (tx) => {
        await tx.delete(users).where(eq(users.id, candidate.id));
      });
      deleted += 1;
      console.log(`[account-deletion] permanently deleted ${candidate.id}`);
    } catch (error) {
      skipped += 1;
      console.error(`[account-deletion] failed for ${candidate.id}`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[account-deletion] complete: deleted=${deleted} skipped=${skipped} cutoff=${cutoff.toISOString()}`);
}

main().catch((error) => {
  console.error("[account-deletion] worker failed", error);
  process.exitCode = 1;
});
