import { spawnSync } from "node:child_process";

const exceptionId = "GHSA-vfj7-8cjw-p6xm";
const exceptionExpires = "2026-11-13T00:00:00Z";
const affectedDevelopmentPackages = new Set([
  "braces",
  "micromatch",
  "fast-glob",
  "@next/eslint-plugin-next",
  "eslint-config-next",
]);

function runAudit(args) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function parseReport(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch {
    process.stderr.write(result.stderr);
    throw new Error(label + " did not return valid JSON");
  }
}

const production = runAudit([
  "audit", "--workspaces", "--include-workspace-root", "--omit=dev", "--audit-level=high", "--json",
]);
if (production.status !== 0) {
  process.stderr.write(production.stdout || production.stderr);
  throw new Error("Production dependency audit failed. Fix all high and critical production vulnerabilities.");
}

const fullResult = runAudit(["audit", "--workspaces", "--include-workspace-root", "--json"]);
const full = parseReport(fullResult, "Full dependency audit");
const now = Date.now();
const expiry = Date.parse(exceptionExpires);
if (!Number.isFinite(expiry) || now >= expiry) {
  throw new Error("The temporary braces advisory exception expired. Recheck upstream and remove or renew the exception with explicit review.");
}

const allowed = [];
const failures = [];
for (const [name, vulnerability] of Object.entries(full.vulnerabilities ?? {})) {
  if (!["high", "critical"].includes(vulnerability.severity)) continue;
  const advisoryEntries = (vulnerability.via ?? []).filter((entry) => typeof entry === "object" && entry !== null);
  const onlyKnownAdvisory = advisoryEntries.length > 0 && advisoryEntries.every((entry) =>
    String(entry.url ?? "").toLowerCase().includes(exceptionId.toLowerCase()) ||
    String(entry.source ?? "") === exceptionId
  );
  if (vulnerability.severity === "high" && affectedDevelopmentPackages.has(name) && onlyKnownAdvisory) {
    allowed.push(name);
    continue;
  }
  failures.push({ name, severity: vulnerability.severity, via: vulnerability.via });
}

if (failures.length) {
  process.stderr.write(JSON.stringify({ failures, audit: full.metadata?.vulnerabilities }, null, 2) + "\n");
  throw new Error("Dependency audit found high/critical findings outside the temporary, development-only braces exception.");
}
if (fullResult.status !== 0 && allowed.length === 0) {
  process.stderr.write(fullResult.stdout || fullResult.stderr);
  throw new Error("Dependency audit failed without a matching approved exception.");
}

console.log("Production dependency audit passed with no high or critical vulnerabilities.");
if (allowed.length) {
  console.warn("Temporary development-tooling exception: " + exceptionId + " affects " + [...new Set(allowed)].sort().join(", ") + ".");
  console.warn("No patched braces release is currently published. This exception expires 2026-11-13 and must be removed once upstream is fixed.");
}
