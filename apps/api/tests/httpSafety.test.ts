import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicTargetUrl } from "../src/services/httpSafety.js";

test("public target validation rejects private and mapped IPv4 addresses", async () => {
  await assert.rejects(() => assertPublicTargetUrl("http://127.0.0.1:8080"), /private target/);
  await assert.rejects(() => assertPublicTargetUrl("http://[::ffff:127.0.0.1]:8080"), /private target/);
  await assert.rejects(() => assertPublicTargetUrl("http://10.0.0.1"), /private target/);
});
