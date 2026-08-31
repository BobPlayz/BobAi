import { createHash } from "node:crypto";

const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

export function validatePassword(password: unknown) {
  if (typeof password !== "string") return "password is required";
  if (password.length < PASSWORD_MIN) return "password must be at least 12 characters";
  if (password.length > PASSWORD_MAX) return "password must be 128 characters or fewer";
  if (/^\s+$/.test(password)) return "password cannot contain only whitespace";
  return null;
}

export async function isPasswordBreached(password: string) {
  const digest = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "BobAI-password-policy" },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const body = await response.text();
    return body.split(/\r?\n/).some((line) => line.split(":", 1)[0]?.trim() === suffix);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enforcePasswordPolicy(password: unknown) {
  const error = validatePassword(password);
  if (error) return error;
  if (await isPasswordBreached(password as string)) return "choose a different password because this password has appeared in known data breaches";
  return null;
}
