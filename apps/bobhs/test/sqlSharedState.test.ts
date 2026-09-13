import test from "node:test";
import assert from "node:assert/strict";
import { SqlSharedState } from "../src/sqlSharedState.js";

test("SQL shared state uses atomic optimistic updates", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const store = new SqlSharedState(async <T>(sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    if (sql.startsWith("CREATE")) return [] as T[];
    return [{ state_key: "x", version: 2, value_json: { ok: true }, updated_at: "2026-01-01T00:00:00Z" }] as T[];
  });
  await store.ensureSchema();
  const record = await store.write("x", { ok: true }, 1);
  assert.equal(record.version, 2);
  assert.match(calls.at(-1)!.sql, /WHERE bobhs_shared_state\.version = \$3/);
  assert.equal(calls.at(-1)!.params[2], 1);
});
