import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

const MAX_OUTPUT_BYTES = 1 * 1024 * 1024;
const file = process.argv[2]?.trim();
if (!file) throw new Error("usage: npm run db:backup:verify -- <backup-file>");
const info = await stat(file).catch(() => null);
if (!info?.isFile() || info.size < 1024) throw new Error("backup file is missing or unexpectedly small");

await new Promise<void>((resolve, reject) => {
  const child = spawn("pg_restore", ["--list", file], { stdio: ["ignore", "pipe", "pipe"], shell: false });
  let output = "";
  let error = "";
  let rejectedForSize = false;
  const append = (target: "output" | "error", chunk: Buffer | string) => {
    const text = chunk.toString();
    if (Buffer.byteLength(output, "utf8") + Buffer.byteLength(error, "utf8") + Buffer.byteLength(text, "utf8") > MAX_OUTPUT_BYTES) {
      rejectedForSize = true;
      child.kill();
      reject(new Error("pg_restore verification output exceeded the 1 MB limit"));
      return;
    }
    if (target === "output") output += text; else error += text;
  };
  child.stdout.on("data", (chunk) => append("output", chunk));
  child.stderr.on("data", (chunk) => append("error", chunk));
  child.once("error", (cause) => { if (!rejectedForSize) reject(new Error(`pg_restore is unavailable: ${cause instanceof Error ? cause.message : String(cause)}`)); });
  child.once("exit", (code) => {
    if (rejectedForSize) return;
    if (code !== 0) return reject(new Error(`backup verification failed: ${error.trim() || `pg_restore exited with code ${code ?? "unknown"}`}`));
    if (!output.includes("TABLE DATA") && !output.includes("TABLE ")) return reject(new Error("backup contains no database table entries"));
    console.log(`backup verified: ${file}`);
    resolve();
  });
});
