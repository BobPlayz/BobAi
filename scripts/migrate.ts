import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const root = process.cwd();
const migrationsDir = path.join(root, "drizzle");
const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql`CREATE TABLE IF NOT EXISTS bobai_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const files = (await readdir(migrationsDir)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const [existing] = await sql`SELECT id FROM bobai_migrations WHERE id = ${id} LIMIT 1`;
    if (existing) continue;
    const contents = await readFile(path.join(migrationsDir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`INSERT INTO bobai_migrations (id) VALUES (${id})`;
    });
    console.log(`applied migration ${id}`);
  }
  console.log("database migrations complete");
} finally {
  await sql.end({ timeout: 5 });
}
