import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, emailOtps, users } from "@bobai/db";

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const same = (a: string, b: string) => {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
};

export type OtpSender = (email: string, code: string) => Promise<void>;
let sender: OtpSender | null = null;
export const setOtpSender = (next: OtpSender | null) => { sender = next; };

export const requestEmailOtp = async (email: string) => {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) return;
  const [recent] = await db.select({ id: emailOtps.id }).from(emailOtps).where(and(eq(emailOtps.userId, user.id), gt(emailOtps.createdAt, new Date(Date.now() - 60_000)))).limit(1);
  if (recent) return;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(emailOtps).values({ userId: user.id, codeHash: hash(code), expiresAt: new Date(Date.now() + TTL_MS) });
  if (sender) await sender(email, code);
};

export const verifyEmailOtp = async (email: string, code: string) => {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user || !/^\d{6}$/.test(code)) return false;
  const [otp] = await db.select().from(emailOtps).where(and(eq(emailOtps.userId, user.id), isNull(emailOtps.consumedAt), gt(emailOtps.expiresAt, new Date()))).orderBy(desc(emailOtps.createdAt)).limit(1);
  if (!otp || otp.attempts >= MAX_ATTEMPTS) return false;
  if (!same(hash(code), otp.codeHash)) {
    await db.update(emailOtps).set({ attempts: otp.attempts + 1 }).where(eq(emailOtps.id, otp.id));
    return false;
  }
  await db.transaction(async tx => {
    await tx.update(emailOtps).set({ consumedAt: new Date() }).where(eq(emailOtps.id, otp.id));
    await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
  });
  return true;
};
