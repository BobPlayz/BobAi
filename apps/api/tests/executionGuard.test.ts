import test from "node:test";
import assert from "node:assert/strict";
import { boundedExecutionResult } from "../src/services/executionGuard.js";

test("execution result byte limits count UTF-8 bytes and reject undefined", () => {
  assert.doesNotThrow(() => boundedExecutionResult({ value: "x".repeat(1000) }));
  assert.throws(() => boundedExecutionResult({ value: "🙂".repeat(600_000) }), /2 MB/);
  assert.throws(() => boundedExecutionResult(undefined), /JSON-serializable/);
});
