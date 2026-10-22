import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";
const { describeStartupError } = await import("../src/app.js");

test("startup diagnostics never reveal credentials, keys or emails", () => {
  const error = Object.assign(new Error("connect failed for postgres://neondb_owner:npg_SuperSecret123@ep-x.neon.tech/db using re_AbCdEf123456_XYZ and token abcdefghijklmnopqrstuvwxyz0123456789ABCD for me@example.com\nstack line"), { code: "ECONNREFUSED" });
  const described = describeStartupError(error);
  const text = JSON.stringify(described);
  assert.equal(described.code, "ECONNREFUSED");
  for (const secret of ["npg_SuperSecret123", "neondb_owner", "re_AbCdEf123456_XYZ", "abcdefghijklmnopqrstuvwxyz0123456789ABCD", "me@example.com", "stack line"]) assert.ok(!text.includes(secret), `leaked ${secret}`);
  assert.match(described.message, /connect failed/);
});

test("requests under /api reach the same routes as requests at the root", async () => {
  const { app } = await import("../src/app.js");
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    for (const path of ["/health", "/api/health"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200, path);
      assert.equal(((await response.json()) as { status?: string }).status, "ok");
    }
  } finally { server.close(); }
});
