#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const SOURCE_COMMIT = "b92c1f787d8c2e0dbee4ac15da4eee1268e88dea";
const files = [
  "ARCHITECTURE.md",
  "BOBAI_AGENT_RULES.md",
  "LAUNCH_CHECKLIST.md",
  "SECURITY.md",
  "apps/api/docs/AGENT_WORKFLOW.md",
  "apps/api/docs/API.md",
  "apps/api/docs/CAPABILITY_PROVIDERS.md",
  "apps/bobhs/README.md",
  "apps/web/AGENTS.md",
  "apps/web/CLAUDE.md",
  "apps/web/README.md",
  "docs/BACKEND_FINAL.md",
  "docs/BOBAI-HANDOFF-2026-09-11.md",
  "docs/CODING_AGENTS.md",
  "docs/FINAL-BACKEND-AUDIT.md",
  "docs/LOCAL_MEDIA.md",
  "docs/MODEL_TRAINING.md",
  "docs/PRIVACY.md",
  "docs/TERMS.md",
  "docs/TRAINING_RUNBOOK.md",
  "docs/auth-setup.md",
  "docs/user-demand-2026.md",
  "model-training/PRODUCTION_TRAINING.md",
  "model-training/README.md",
  "model-training/TRAINING_CONTROL.md",
  "native/media/README.md",
  "scripts/bobredis/README.md"
];

const root = ".bobai-internal";
mkdirSync(root, { recursive: true });

for (const source of files) {
  const target = join(root, source);
  mkdirSync(dirname(target), { recursive: true });
  const data = execFileSync("git", ["show", `${SOURCE_COMMIT}:${source}`], { encoding: "utf8" });
  writeFileSync(target, data, "utf8");
}

console.log(`Restored ${files.length} local-only BobAI internal files into ${root}/`);
console.log("They are ignored by .gitignore and are not part of the public repository.");
