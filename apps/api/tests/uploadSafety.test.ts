import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";
const { isLowRiskUpload, scanUpload, MalwareScannerUnavailableError } = await import("../src/services/malwareScanner.js");

test("plain text and verified images count as low risk; PDFs, binaries and fake text don't", () => {
  assert.equal(isLowRiskUpload(Buffer.from("notes: buy milk ✅"), "text/plain", false), true);
  assert.equal(isLowRiskUpload(Buffer.from("const a = 1;"), "text/javascript", false), true);
  assert.equal(isLowRiskUpload(Buffer.from("{\"a\":1}"), "application/json", false), true);
  assert.equal(isLowRiskUpload(Buffer.from([0x68, 0x00, 0x69]), "text/plain", false), false);
  assert.equal(isLowRiskUpload(Buffer.from([0xff, 0xfe, 0xfd]), "text/plain", false), false);
  assert.equal(isLowRiskUpload(Buffer.from("%PDF-1.7"), "application/pdf", false), false);
  assert.equal(isLowRiskUpload(Buffer.from([0x89, 0x50]), "image/png", true), true);
});

test("in production without a scanner, low-risk files pass and everything else is refused", async () => {
  const saved = { env: process.env.NODE_ENV, url: process.env.BOBAI_MALWARE_SCANNER_URL, req: process.env.BOBAI_MALWARE_SCAN_REQUIRED };
  try {
    process.env.NODE_ENV = "production"; delete process.env.BOBAI_MALWARE_SCANNER_URL; delete process.env.BOBAI_MALWARE_SCAN_REQUIRED;
    assert.deepEqual(await scanUpload(Buffer.from("hi"), "a.txt", "text/plain", { lowRisk: true }), { clean: true, status: "skipped" });
    await assert.rejects(scanUpload(Buffer.from("%PDF-1.7"), "a.pdf", "application/pdf"), MalwareScannerUnavailableError);
    // A PDF whose text was extracted is kept as text only (the original bytes are never stored), so it is allowed.
    assert.deepEqual(await scanUpload(Buffer.from("%PDF-1.7"), "a.pdf", "application/pdf", { textOnly: true }), { clean: true, status: "text-only" });
  } finally {
    process.env.NODE_ENV = saved.env;
    if (saved.url === undefined) delete process.env.BOBAI_MALWARE_SCANNER_URL; else process.env.BOBAI_MALWARE_SCANNER_URL = saved.url;
    if (saved.req === undefined) delete process.env.BOBAI_MALWARE_SCAN_REQUIRED; else process.env.BOBAI_MALWARE_SCAN_REQUIRED = saved.req;
  }
});
