import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db, webhookDeliveries, webhooks } from "@bobai/db";

const MAX_PAYLOAD_BYTES = 512 * 1024;
const MAX_ATTEMPTS = 4;
const SIGNATURE_TTL_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 15_000;

function hmac(secret: string, value: string) { return createHmac("sha256", secret).update(value).digest("hex"); }
function validUrl(value: string) {
  try { const url = new URL(value); if (url.protocol !== "https:") return false; return true; } catch { return false; }
}
function signature(secret: string, timestamp: number, eventId: string, payload: string) { return `sha256=${hmac(secret, `${timestamp}.${eventId}.${payload}`)}`; }
function safeCompare(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }

export async function deliverWebhook(webhookId: string, workspaceId: string, event: string, payload: unknown) {
  const [hook] = await db.select().from(webhooks).where(and(eq(webhooks.id, webhookId), eq(webhooks.workspaceId, workspaceId), eq(webhooks.isEnabled, true), isNull(webhooks.deletedAt))).limit(1);
  if (!hook || !hook.secret || !validUrl(hook.url)) throw new Error("webhook unavailable");
  const events = Array.isArray(hook.events) ? hook.events.filter((item): item is string => typeof item === "string") : [];
  if (!events.includes(event) && !events.includes("*")) return { delivered: false, skipped: true };
  const body = JSON.stringify({ id: randomUUID(), event, createdAt: new Date().toISOString(), data: payload });
  if (Buffer.byteLength(body, "utf8") > MAX_PAYLOAD_BYTES) throw new Error("webhook payload too large");
  const eventId = JSON.parse(body).id as string;
  const [delivery] = await db.insert(webhookDeliveries).values({ webhookId, workspaceId, eventId }).onConflictDoNothing({ target: webhookDeliveries.eventId }).returning({ id: webhookDeliveries.id });
  if (!delivery) return { delivered: false, duplicate: true };
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const timestamp = Math.floor(Date.now() / 1000);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { "content-type": "application/json", "x-bobai-event-id": eventId, "x-bobai-event": event, "x-bobai-timestamp": String(timestamp), "x-bobai-signature": signature(hook.secret, timestamp, eventId, body) };
      if (hook.headers && typeof hook.headers === "object" && !Array.isArray(hook.headers)) for (const [key, value] of Object.entries(hook.headers as Record<string, unknown>)) if (/^[A-Za-z0-9-]{1,64}$/.test(key) && typeof value === "string" && value.length <= 2_000 && !/^authorization$/i.test(key)) headers[key] = value;
      const response = await fetch(hook.url, { method: "POST", headers, body, signal: controller.signal, redirect: "error" });
      const raw = await response.text();
      if (raw.length > 64 * 1024) throw new Error("webhook response too large");
      if (response.ok) { await db.update(webhookDeliveries).set({ status: "delivered", attempts: attempt, deliveredAt: new Date(), updatedAt: new Date(), lastError: null }).where(eq(webhookDeliveries.id, delivery.id)); await db.update(webhooks).set({ lastTriggeredAt: new Date(), updatedAt: new Date() }).where(eq(webhooks.id, webhookId)); return { delivered: true, attempts: attempt, eventId }; }
      lastError = `webhook returned ${response.status}`;
      if (![408, 409, 425, 429].includes(response.status) && response.status < 500) break;
    } catch (error) { lastError = error instanceof Error ? error.message : "webhook delivery failed"; }
    finally { clearTimeout(timer); }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }
  await db.update(webhookDeliveries).set({ status: "failed", attempts: MAX_ATTEMPTS, lastError: lastError.slice(0, 2_000), updatedAt: new Date() }).where(eq(webhookDeliveries.id, delivery.id));
  return { delivered: false, attempts: MAX_ATTEMPTS, eventId, error: "webhook delivery failed" };
}

export function verifyWebhookSignature(secret: string, timestamp: string, eventId: string, payload: string, supplied: string) {
  if (!secret || !/^\d{10}$/.test(timestamp) || !eventId || eventId.length > 200) return false;
  const ts = Number(timestamp); if (!Number.isSafeInteger(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > SIGNATURE_TTL_SECONDS) return false;
  return safeCompare(signature(secret, ts, eventId, payload), supplied);
}

export async function cleanupWebhookDeliveries() { const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); const rows = await db.delete(webhookDeliveries).where(lt(webhookDeliveries.createdAt, cutoff)).returning({ id: webhookDeliveries.id }); return rows.length; }
