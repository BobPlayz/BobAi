import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";
const { GUEST_EMAIL_DOMAIN, isGuestEmail } = await import("../src/services/guest.js");
const { sendEmail } = await import("../src/services/email.js");

test("guest addresses use the reserved .invalid domain and are recognised", () => {
  assert.ok(GUEST_EMAIL_DOMAIN.endsWith(".invalid"));
  assert.equal(isGuestEmail(`guest-abc@${GUEST_EMAIL_DOMAIN}`), true);
  assert.equal(isGuestEmail(`GUEST-ABC@${GUEST_EMAIL_DOMAIN.toUpperCase()}`), true);
  assert.equal(isGuestEmail("someone@gmail.com"), false);
  assert.equal(isGuestEmail(`someone@${GUEST_EMAIL_DOMAIN}.evil.com`), false);
  assert.equal(isGuestEmail(null), false);
});

test("no email is ever sent to a guest (.invalid) address", async () => {
  await assert.rejects(sendEmail(`guest-abc@${GUEST_EMAIL_DOMAIN}`, "hi", "hi"), /can't receive email/);
});
