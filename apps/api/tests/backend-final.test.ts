import test from "node:test";
import assert from "node:assert/strict";

test("backend security checks are runnable", () => {
  assert.equal(typeof process.env.NODE_ENV, "string");
});

test("production configuration has required security values", () => {
  if (process.env.NODE_ENV !== "production") return;
  assert.ok(process.env.BOBAI_JWT_SECRET);
  assert.ok(process.env.BOBAI_ADMIN_EMAILS);
});
