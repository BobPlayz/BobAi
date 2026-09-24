import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const required = ["README.md", "package.json", "package-lock.json", ".env.example", "apps/api", "apps/web", "apps/bobhs", "packages/db", "model-training"];
const forbiddenSecret = /(?:sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const allowedEnv = new Set([".env.example", "apps/api/.env.example"]);

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function trackedFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], { maxBuffer: 4 * 1024 * 1024 });
  return stdout.split("\0").filter(Boolean);
}

async function main() {
  const missing = [];
  for (const path of required) if (!(await exists(path))) missing.push(path);

  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const requiredScripts = ["build", "test", "audit", "smoke", "repo:preflight"];
  const missingScripts = requiredScripts.filter((name) => typeof packageJson.scripts?.[name] !== "string");

  const files = await trackedFiles();
  const markdown = files.filter((path) => path.toLowerCase().endsWith(".md"));
  const nonRootMarkdown = markdown.filter((path) => path !== "README.md");
  if (nonRootMarkdown.length) throw new Error(`Public repository may only contain README.md as Markdown: ${nonRootMarkdown.join(", ")}`);

  const trackedEnv = files.filter((path) => /(^|\/)\.env(?:\.|$)/i.test(path) && !allowedEnv.has(path));
  if (trackedEnv.length) throw new Error(`Tracked environment files are forbidden: ${trackedEnv.join(", ")}`);

  for (const path of allowedEnv) {
    if (!(await exists(path))) continue;
    const content = await readFile(path, "utf8");
    if (forbiddenSecret.test(content)) throw new Error(`${path} contains a secret-shaped value`);
  }

  if (missing.length || missingScripts.length) {
    console.error(JSON.stringify({ ok: false, missing, missingScripts }));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ ok: true, requiredPaths: required.length, requiredScripts: requiredScripts.length, markdownPolicy: "README.md only", trackedEnvironmentPolicy: "example files only" }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});