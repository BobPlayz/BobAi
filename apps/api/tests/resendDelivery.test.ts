import test from "node:test";
import assert from "node:assert/strict";
import { sendResendOtp } from "../src/services/otpDelivery.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.RESEND_FROM_EMAIL;
function restore() {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
  if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = originalFrom;
}

test("Resend sends a verification email using server-side credentials", async () => {
  try {
    process.env.RESEND_API_KEY = "test_key";
    process.env.RESEND_FROM_EMAIL = "BobAI <verified@example.test>";
    let captured: { url: string; init?: RequestInit } | undefined;
    globalThis.fetch = async (input, init) => {
      captured = { url: String(input), init };
      return new Response(JSON.stringify({ id: "email_test_id" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    await sendResendOtp("person@example.test", "123456");
    assert.equal(captured?.url, "https://api.resend.com/emails");
    assert.equal(captured?.init?.method, "POST");
    const headers = captured?.init?.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer test_key");
    const body = JSON.parse(String(captured?.init?.body));
    assert.deepEqual(body.to, ["person@example.test"]);
    assert.match(body.text, /123456/);
    assert.equal(body.from, "BobAI <verified@example.test>");
  } finally { restore(); }
});

test("Resend refuses to run without a key and verified sender setting", async () => {
  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    await assert.rejects(() => sendResendOtp("person@example.test", "123456"), /not configured/);
  } finally { restore(); }
});

test("Resend provider errors are surfaced without exposing credentials", async () => {
  try {
    process.env.RESEND_API_KEY = "private_test_key";
    process.env.RESEND_FROM_EMAIL = "BobAI <verified@example.test>";
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "rate limited" }), { status: 429 });
    await assert.rejects(() => sendResendOtp("person@example.test", "123456"), (error: Error) => {
      assert.match(error.message, /HTTP 429/);
      assert.equal(error.message.includes("private_test_key"), false);
      return true;
    });
  } finally { restore(); }
});
