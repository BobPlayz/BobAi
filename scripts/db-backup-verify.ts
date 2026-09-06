import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

const file = process.argv[2]?.trim();
if (!file) throw new Error("usage: npm run db:backup:verify -- <backup-file>");
const info = await stat(file).catch(() => null);
if (!info?.isFile() || info.size < 1024) throw new Error("backup file is missing or unexpectedly small");

await new Promise<void>((resolve, reject) => {
  const child = spawn("pg_restore", ["--list", file], { stdio: ["ignore", "pipe", "pipe"], shell: false });
  let output = "";
  let error = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { error += chunk.toString(); });
  child.once("error", (cause) => reject(new Error(`pg_restore is unavailable: ${cause instanceof Error ? cause.message : String(cause)}`)));
  child.once("exit", (code) => {
    if (code !== 0) return reject(new Error(`backup verification failed: ${error.trim() || `pg_restore exited with code ${code ?? "unknown"}`}`));
    if (!output.includes("TABLE DATA") && !output.includes("TABLE ")) return reject(new Error("backup contains no database table entries"));
    console.log(`backup verified: ${file}`);
    resolve();
  });
});
