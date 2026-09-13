import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const required = ["package.json", "package-lock.json", ".env.example", "ARCHITECTURE.md", "SECURITY.md", "roadmap.md", "docs/BOBAI-HANDOFF-2026-09-11.md", "apps/api", "apps/web", "apps/bobhs", "packages/db", "model-training"];
const forbiddenSecret = /(?:sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;

async function exists(path) { try { await access(path); return true; } catch { return false; } }

async function main() {
  const missing = [];
  for (const path of required) if (!(await exists(path))) missing.push(path);
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const requiredScripts = ["build", "test", "audit", "smoke", "bobhs", "bobhs:build", "bobhs:test", "model:train", "model:evaluate"];
  const missingScripts = requiredScripts.filter(name => typeof packageJson.scripts?.[name] !== "string");
  const env = await readFile(".env.example", "utf8");
  const roadmap = await readFile("roadmap.md", "utf8");
  const handoff = await readFile("docs/BOBAI-HANDOFF-2026-09-11.md", "utf8");
  if (forbiddenSecret.test(env)) throw new Error(".env.example contains a secret-shaped value");
  if (!roadmap.startsWith("# BobAI roadmap\n")) throw new Error("roadmap.md has an unexpected format");
  if (!handoff.startsWith("# BobAI handoff")) throw new Error("BobAI handoff has an unexpected format");
  if (missing.length || missingScripts.length) { console.error(JSON.stringify({ ok: false, missing, missingScripts })); process.exitCode = 1; return; }
  console.log(JSON.stringify({ ok: true, requiredPaths: required.length, requiredScripts: requiredScripts.length }));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
