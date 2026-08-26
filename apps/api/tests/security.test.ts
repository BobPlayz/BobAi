import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.BOBAI_TEST_URL;

test("security integration tests require an explicit test server", { skip: !base }, async (t) => {
  const response = await fetch(`${base}/v1/admin/me`);
  assert.equal(response.status, 401);

  const unauthenticated = await fetch(`${base}/v1/conversations`);
  assert.ok([401, 403].includes(unauthenticated.status));

  t.diagnostic("Run the full suite against an isolated test database before deployment.");
});
