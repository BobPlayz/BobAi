import assert from "node:assert/strict";
import test from "node:test";
import { hasCapabilities, idempotencyKey, signWebhook, toolResult, validateJobBudget, verifyWebhook } from "../src/services/platformPrimitives.js";

test("capabilities require every requested capability", () => {
  assert.equal(hasCapabilities(["files", "vision"], ["files"]), true);
  assert.equal(hasCapabilities(["files"], ["files", "vision"]), false);
});

test("job budgets reject unsafe values", () => {
  assert.equal(validateJobBudget({ maxAttempts: 3, timeoutMs: 60_000, maxOutputBytes: 1_000_000 }), true);
  assert.equal(validateJobBudget({ maxAttempts: 99 }), false);
});

test("webhook signatures expire and verify safely", () => {
  const payload = JSON.stringify({ event: "job.completed" });
  const timestamp = String(Date.now());
  const signature = signWebhook(payload, "test-secret", timestamp);
  assert.equal(verifyWebhook(payload, "test-secret", timestamp, signature), true);
  assert.equal(verifyWebhook(payload, "wrong-secret", timestamp, signature), false);
});

test("tool results are structured and idempotency keys are scoped", () => {
  const result = toolResult(true, "ok", { value: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.code, "ok");
  assert.equal(idempotencyKey("u1", "job"), "u1:job");
  assert.notEqual(idempotencyKey("u1", "job"), idempotencyKey("u2", "job"));
});
