import { createHash, randomInt } from "node:crypto";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export type OtpRecord = {
  hash: string;
  expiresAt: number;
  attempts: number;
};

const records = new Map<string, OtpRecord>();

export const createOtp = (key: string, ttlMs = 10 * 60_000) => {
  const code = randomInt(100000, 1_000_000).toString();
  records.set(key, { hash: hash(code), expiresAt: Date.now() + ttlMs, attempts: 0 });
  return code;
};

export const verifyOtp = (key: string, code: string, maxAttempts = 5) => {
  const record = records.get(key);
  if (!record || record.expiresAt < Date.now() || record.attempts >= maxAttempts) {
    records.delete(key);
    return false;
  }
  record.attempts++;
  const valid = hash(code) === record.hash;
  if (valid || record.attempts >= maxAttempts) records.delete(key);
  return valid;
};
