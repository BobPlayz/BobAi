import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const root = process.cwd();
  const migrationsDir = path.join(root, "drizzle");
  const sql = postgres(databaseUrl, { max: 1 });
  const migrationLock = "bobai:migrations";

  try {
    await sql`SELECT pg_advisory_lock(hashtextextended(${migrationLock}, 0))`;
    await sql`CREATE TABLE IF NOT EXISTS bobai_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    await sql`ALTER TABLE bobai_migrations ADD COLUMN IF NOT EXISTS checksum text`;

    const files = (await readdir(migrationsDir)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const id = file.replace(/\.sql$/, "");
      const contents = await readFile(path.join(migrationsDir, file), "utf8");
      const checksum = createHash("sha256").update(contents).digest("hex");
      const [existing] = await sql`SELECT checksum FROM bobai_migrations WHERE id = ${id} LIMIT 1`;

      if (existing) {
        if (existing.checksum && existing.checksum !== checksum) throw new Error(`migration ${id} was modified after it was applied`);
        if (!existing.checksum) await sql`UPDATE bobai_migrations SET checksum = ${checksum} WHERE id = ${id}`;
        continue;
      }

      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`INSERT INTO bobai_migrations (id, checksum) VALUES (${id}, ${checksum})`;
      });
      console.log(`applied migration ${id}`);
    }
    console.log("database migrations complete");
  } finally {
    try {
      await sql`SELECT pg_advisory_unlock(hashtextextended(${migrationLock}, 0))`;
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
