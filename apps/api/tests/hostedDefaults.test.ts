import assert from "node:assert/strict";
import test from "node:test";
import { applyHostedDefaults } from "../src/config/hostedDefaults.js";

const AGENT_KEY = "a".repeat(40);
const base = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "jarvis.example.app", VERCEL_URL: "jarvis-abc123.vercel.app", DATABASE_URL: "postgres://u:p@db.example/neondb", BOBAI_AGENT_KEY: AGENT_KEY, BOBAI_SMTP_HOST: "smtp.gmail.com", BOBAI_SMTP_FROM: "Jarvis <someone@gmail.com>" };

function run(env: Record<string, string>) {
  const saved = { ...process.env };
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env);
  try { const changed = applyHostedDefaults(); return { changed, env: { ...process.env } }; } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

test("values copied from .env.example are replaced on Vercel and production mode turns on", () => {
  const { changed, env } = run({ ...base, NODE_ENV: "development", CORS_ORIGIN: "http://localhost:3000", BOBAI_WEB_URL: "http://localhost:3000", BOBAI_AUTH_REDIRECT_BASE_URL: "http://localhost:3001" });
  assert.equal(env.BOBAI_WEB_URL, "https://jarvis.example.app");
  assert.equal(env.BOBAI_AUTH_REDIRECT_BASE_URL, "https://jarvis.example.app/api");
  assert.equal(env.CORS_ORIGIN, "https://jarvis.example.app,https://jarvis-abc123.vercel.app");
  assert.equal(env.NODE_ENV, "production");
  assert.deepEqual(changed.sort(), ["BOBAI_AUTH_REDIRECT_BASE_URL", "BOBAI_WEB_URL", "CORS_ORIGIN", "NODE_ENV"]);
});

test("real settings are kept, with the deployment's own origins added", () => {
  const { env } = run({ ...base, CORS_ORIGIN: "https://my.custom.site", BOBAI_WEB_URL: "https://my.custom.site", BOBAI_AUTH_REDIRECT_BASE_URL: "https://my.custom.site/api" });
  assert.equal(env.BOBAI_WEB_URL, "https://my.custom.site");
  assert.equal(env.CORS_ORIGIN, "https://my.custom.site,https://jarvis.example.app,https://jarvis-abc123.vercel.app");
  assert.equal(env.NODE_ENV, "production");
});

test("production mode stays off while required configuration is still missing, so the site is not taken down", () => {
  const { env } = run({ ...base, NODE_ENV: "development", BOBAI_AGENT_KEY: "" });
  assert.equal(env.NODE_ENV, "development");
});

test("nothing changes off Vercel or in local Vercel development", () => {
  assert.deepEqual(run({ NODE_ENV: "development", CORS_ORIGIN: "http://localhost:3000" }).changed, []);
  assert.deepEqual(run({ ...base, VERCEL_ENV: "development", NODE_ENV: "development" }).changed, []);
});
