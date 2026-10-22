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
