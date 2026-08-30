import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { app } = await import("../src/app.js");
const { buildSystemPrompt } = await import("../src/services/chatEngine.js");
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

test.after(() => server.close());

test("unauthenticated users cannot access admin data", async () => {
  const response = await fetch(`${base}/v1/admin/me`);
  assert.equal(response.status, 401);
});

test("unauthenticated users cannot access conversations", async () => {
  const response = await fetch(`${base}/v1/conversations`);
  assert.ok([401, 403].includes(response.status));
});

test("request ids are generated and security headers are present", async () => {
  const response = await fetch(`${base}/missing-route`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get("x-request-id") || "", /^[A-Za-z0-9._:-]{1,128}$/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});

test("unsafe object keys are rejected before protected route handling", async () => {
  const response = await fetch(`${base}/v1/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ constructor: { polluted: true } }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid request structure" });
});

test("error responses do not expose stack traces", async () => {
  const response = await fetch(`${base}/v1/capabilities/not-a-real-capability`);
  assert.ok([401, 404].includes(response.status));
  const body = await response.text();
  assert.equal(body.includes("Error:") || body.includes(" at "), false);
});

test("user-facing system prompt forbids internal execution details", () => {
  const prompt = buildSystemPrompt("").content;
  assert.match(prompt, /must not expose internal tool calls/i);
  assert.match(prompt, /shell\/terminal commands/i);
  assert.match(prompt, /credentials/i);
});
