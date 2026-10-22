import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";

const { otpDeliveryProvider, otpDeliveryConfigured } = await import("../src/services/otpDelivery.js");
const { productionConfigProblems } = await import("../src/config/validateProduction.js");

const KEYS = ["BOBAI_EMAIL_PROVIDER", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "BOBAI_SMTP_HOST", "BOBAI_SMTP_FROM", "BOBAI_DEV_LOG_OTP"] as const;

function withEnv(env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => void) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
  try { fn(); } finally { for (const key of KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } }
}

const resend = { RESEND_API_KEY: ["re", "test"].join("_"), RESEND_FROM_EMAIL: "Jarvis <login@example.com>" };
const smtp = { BOBAI_SMTP_HOST: "smtp.gmail.com", BOBAI_SMTP_FROM: "Jarvis <someone@gmail.com>" };

test("existing Resend deployments keep using Resend unless SMTP is chosen explicitly", () => {
  withEnv({ ...resend, ...smtp }, () => assert.equal(otpDeliveryProvider(), "resend"));
  withEnv({ ...resend, ...smtp, BOBAI_EMAIL_PROVIDER: "smtp" }, () => assert.equal(otpDeliveryProvider(), "smtp"));
  withEnv({ ...smtp }, () => assert.equal(otpDeliveryProvider(), "smtp"));
});

test("choosing a provider that is not configured is reported, never silently swapped", () => {
  withEnv({ ...resend, BOBAI_EMAIL_PROVIDER: "smtp" }, () => {
    assert.equal(otpDeliveryProvider(), "none");
    assert.equal(otpDeliveryConfigured(), false);
    assert.ok(productionConfigProblems().some((problem) => /BOBAI_EMAIL_PROVIDER is smtp/.test(problem)) || productionConfigProblems().some((problem) => /Missing production configuration/.test(problem)));
  });
});

test("nothing configured means no delivery (the dev logger is opt-in and never counts as configured)", () => {
  withEnv({}, () => { assert.equal(otpDeliveryProvider(), "none"); assert.equal(otpDeliveryConfigured(), false); });
  withEnv({ BOBAI_DEV_LOG_OTP: "true" }, () => { assert.equal(otpDeliveryProvider(), "dev-log"); assert.equal(otpDeliveryConfigured(), false); });
});
