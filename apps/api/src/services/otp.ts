import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db, emailOtps, users } from "@bobai/db";

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const same = (a: string, b: string) => {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
};

export type OtpPurpose = "verification" | "login" | "account-delete";
export type OtpSender = (email: string, code: string) => Promise<void>;
let sender: OtpSender | null = null;
export const setOtpSender = (next: OtpSender | null) => { sender = next; };

export const requestEmailOtp = async (email: string, purpose: OtpPurpose = "verification") => {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) return;
  const [recent] = await db.select({ id: emailOtps.id }).from(emailOtps).where(and(eq(emailOtps.userId, user.id), eq(emailOtps.purpose, purpose), gt(emailOtps.createdAt, new Date(Date.now() - 60_000)))).limit(1);
  if (recent) return;
  if (!sender) throw new Error("OTP delivery is not configured");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Store the code before emailing it, so a database failure can never leave the user holding a code that cannot
  // work; if the email cannot be sent, remove the stored code again.
  const [stored] = await db.insert(emailOtps).values({ userId: user.id, purpose, codeHash: hash(code), expiresAt: new Date(Date.now() + TTL_MS) }).returning({ id: emailOtps.id });
  try {
    await sender(email, code);
  } catch (error) {
    if (stored) await db.delete(emailOtps).where(eq(emailOtps.id, stored.id)).catch(() => undefined);
    throw error;
  }
};

export const verifyEmailOtp = async (email: string, code: string, purpose: OtpPurpose = "verification") => {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user || !/^\d{6}$/.test(code)) return false;
  const [otp] = await db.select().from(emailOtps).where(and(eq(emailOtps.userId, user.id), eq(emailOtps.purpose, purpose), isNull(emailOtps.consumedAt), gt(emailOtps.expiresAt, new Date()))).orderBy(desc(emailOtps.createdAt)).limit(1);
  if (!otp || otp.attempts >= MAX_ATTEMPTS) return false;
  if (!same(hash(code), otp.codeHash)) {
    await db.update(emailOtps).set({ attempts: sql`${emailOtps.attempts} + 1` }).where(and(eq(emailOtps.id, otp.id), isNull(emailOtps.consumedAt), lt(emailOtps.attempts, MAX_ATTEMPTS)));
    return false;
  }
  const consumed = await db.transaction(async tx => {
    const [claimed] = await tx.update(emailOtps).set({ consumedAt: new Date() }).where(and(eq(emailOtps.id, otp.id), isNull(emailOtps.consumedAt), gt(emailOtps.expiresAt, new Date()), lt(emailOtps.attempts, MAX_ATTEMPTS))).returning({ id: emailOtps.id });
    if (!claimed) return false;
    if (purpose === "verification") await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    return true;
  });
  return consumed;
};

export async function cleanupExpiredOtps() {
  await db.delete(emailOtps).where(lt(emailOtps.expiresAt, new Date()));
}
