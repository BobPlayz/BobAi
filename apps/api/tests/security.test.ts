import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

async function main() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

  const { app } = await import("../src/app.js");
  const { parseToolResult } = await import("../src/services/structuredResult.js");
  const { getTool } = await import("../src/services/toolRegistry.js");
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

  test("security headers and request ids are present", async () => {
    const response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("x-request-id") || "", /^[A-Za-z0-9._:-]{1,128}$/);
  });

  test("unsafe request structures are rejected", async () => {
    const response = await fetch(`${base}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ constructor: { polluted: true } }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid request structure" });
  });

  test("unknown protected routes do not reveal route existence", async () => {
    const response = await fetch(`${base}/v1/security-test-does-not-exist`);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "authentication required");
    assert.equal("stack" in body, false);
  });

  test("structured tool results are validated at runtime", () => {
    assert.deepEqual(parseToolResult({ ok: true, data: { value: 1 } })?.ok, true);
    assert.equal(parseToolResult({ ok: true, error: { code: "bad", message: "should not be present" } }), null);
    assert.equal(parseToolResult({ ok: false }), null);
    assert.equal(parseToolResult({ ok: false, error: { code: "bad", message: "nope", retryable: "yes" } }), null);
  });

  test("external write-capable tools require approval", () => {
    assert.equal(getTool("image")?.requiresUserApproval, true);
    assert.equal(getTool("music")?.requiresUserApproval, true);
    assert.equal(getTool("diagrams")?.requiresUserApproval, true);
    assert.equal(getTool("sketch-to-ui")?.requiresUserApproval, true);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
