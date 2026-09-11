import { describe, expect, it } from "vitest";
import { normalizeSandboxPolicy } from "../src/services/sandboxExecutor.js";

describe("sandbox policy", () => {
  it("fails closed on network access and clamps resource limits", () => {
    const policy = normalizeSandboxPolicy({ allowNetwork: true, timeoutMs: 99_999_999, memoryMb: 99_999, cpuCount: 99, maxOutputBytes: 99_999_999 });
    expect(policy.allowNetwork).toBe(false);
    expect(policy.timeoutMs).toBe(900_000);
    expect(policy.memoryMb).toBe(4096);
    expect(policy.cpuCount).toBe(4);
    expect(policy.maxOutputBytes).toBe(2 * 1024 * 1024);
  });
});
