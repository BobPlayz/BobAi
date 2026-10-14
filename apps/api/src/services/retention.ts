import { and, asc, lt, or, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { db, documentChunks, emailOtps, passwordResets, sessions, uploads, users, workspaces } from "@bobai/db";
import { deleteObject } from "./objectStorage.js";
import { purgeUserOwnedData } from "./accountPurge.js";

const OTP_RETENTION_MS = 24 * 60 * 60 * 1000;
const RESET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ACCOUNT_DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
function retentionDays(key: string, fallback: number) { const raw = process.env[key]; if (raw === undefined || raw.trim() === "") return fallback; const value = Number(raw); return Number.isInteger(value) && value >= 0 && value <= 3650 ? value : fallback; }

export async function runRetentionCleanup(now = new Date()) {
  const otpCutoff = new Date(now.getTime() - OTP_RETENTION_MS);
  const resetCutoff = new Date(now.getTime() - RESET_RETENTION_MS);
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_MS);
  const accountCutoff = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_MS);
  const imageRetentionDays = retentionDays("BOBAI_UPLOAD_IMAGE_RETENTION_DAYS", 30);
  const documentRetentionDays = retentionDays("BOBAI_UPLOAD_DOCUMENT_RETENTION_DAYS", 90);
  const imageCutoff = new Date(now.getTime() - imageRetentionDays * DAY_MS);
  const documentCutoff = new Date(now.getTime() - documentRetentionDays * DAY_MS);

  const [otps, resets, sessionsDeleted] = await Promise.all([
    db.delete(emailOtps).where(lt(emailOtps.createdAt, otpCutoff)).returning({ id: emailOtps.id }),
    db.delete(passwordResets).where(lt(passwordResets.createdAt, resetCutoff)).returning({ id: passwordResets.id }),
    db.delete(sessions).where(and(lt(sessions.createdAt, sessionCutoff), or(eq(sessions.isActive, false), isNotNull(sessions.revokedAt)))).returning({ id: sessions.id }),
  ]);

  let accountsDeleted = 0;
  const candidates = await db.select({ id: users.id }).from(users).where(and(isNotNull(users.deletedAt), lt(users.deletedAt, accountCutoff)));
  for (const account of candidates) {
    try {
      const sharedOwned = await db.select({ id: workspaces.id }).from(workspaces).where(and(eq(workspaces.ownerId, account.id), ne(workspaces.type, "personal"))).limit(1);
      if (sharedOwned.length) {
        console.warn("account purge deferred because the user still owns a shared workspace");
        continue;
      }
      await purgeUserOwnedData(account.id);
      accountsDeleted += 1;
    } catch (error) {
      console.error("account purge deferred", error);
    }
  }

  let uploadRows = 0;
  let storageCleanupPending = 0;
  if (imageRetentionDays > 0 || documentRetentionDays > 0) {
    const expiredCategories = [
      ...(imageRetentionDays > 0 ? [and(lt(uploads.createdAt, imageCutoff), sql`${uploads.mimeType} like 'image/%'`)] : []),
      ...(documentRetentionDays > 0 ? [and(lt(uploads.createdAt, documentCutoff), sql`${uploads.mimeType} not like 'image/%'`)] : []),
    ];
    const candidates = await db.select({ id: uploads.id, workspaceId: uploads.workspaceId, storageKey: uploads.storageKey, mimeType: uploads.mimeType, createdAt: uploads.createdAt, metadata: uploads.metadata })
      .from(uploads).where(and(isNull(uploads.deletedAt), or(...expiredCategories))).orderBy(asc(uploads.createdAt)).limit(500);
    for (const file of candidates) {
      const isImage = file.mimeType.startsWith("image/");
      const days = isImage ? imageRetentionDays : documentRetentionDays;
      if (days === 0 || file.createdAt.getTime() >= now.getTime() - days * DAY_MS) continue;
      try {
        const deleted = await db.transaction(async (tx) => {
          const [row] = await tx.update(uploads).set({
            deletedAt: now,
            updatedAt: now,
            metadata: {
              ...(file.metadata && typeof file.metadata === "object" && !Array.isArray(file.metadata) ? file.metadata as Record<string, unknown> : {}),
              processing: "deleted",
              retentionDeletedAt: now.toISOString(),
              retentionDays: days,
            },
          }).where(and(eq(uploads.id, file.id), eq(uploads.workspaceId, file.workspaceId), isNull(uploads.deletedAt))).returning({ id: uploads.id });
          if (!row) return false;
          await tx.delete(documentChunks).where(and(eq(documentChunks.uploadId, file.id), eq(documentChunks.workspaceId, file.workspaceId)));
          return true;
        });
        if (!deleted) continue;
        uploadRows++;
        try { await deleteObject(file.storageKey); } catch { storageCleanupPending++; }
      } catch (error) {
        console.error("upload retention cleanup deferred", error);
      }
    }
  }

  return { otpRows: otps.length, passwordResetRows: resets.length, sessionRows: sessionsDeleted.length, accountRows: accountsDeleted, uploadRows, storageCleanupPending };
}

export function startRetentionWorker(intervalMs = 60 * 60 * 1000) {
  const safeInterval = Math.max(60_000, intervalMs);
  const timer = setInterval(() => { void runRetentionCleanup().catch((error) => { console.error("retention cleanup failed", error); }); }, safeInterval);
  timer.unref();
  return timer;
}
