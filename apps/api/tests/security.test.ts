import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { app } = await import("../src/app.js");
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
