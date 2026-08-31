import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const outputDir = path.resolve(process.env.BOBAI_BACKUP_DIR || "backups");
await mkdir(outputDir, { recursive: true });
const output = path.join(outputDir, `bobai-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);

await new Promise<void>((resolve, reject) => {
  const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--file", output, databaseUrl], { stdio: "inherit", shell: false });
  child.once("error", (error) => reject(new Error(`pg_dump is unavailable: ${error.message}`)));
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited with code ${code ?? "unknown"}`)));
});
console.log(`database backup written to ${output}`);
