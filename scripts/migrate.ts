import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function migrationAlreadySatisfied(sql: ReturnType<typeof postgres>, id: string) {
  if (id.startsWith("0001_")) {
    const [tables] = await sql`
      SELECT
        to_regclass('public.users') IS NOT NULL AS users,
        to_regclass('public.sessions') IS NOT NULL AS sessions
    `;
    if (!tables?.users || !tables?.sessions) return false;

    const [row] = await sql`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash') AS password_hash,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'access_token_hash') AS access_token_hash,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'access_expires_at') AS access_expires_at,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sessions_access_token_hash_unique') AS access_index,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sessions_refresh_token_hash_unique') AS refresh_index
    `;
    return Boolean(row?.password_hash && row?.access_token_hash && row?.access_expires_at && row?.access_index && row?.refresh_index);
  }

  if (id.startsWith("0002_")) {
    const [row] = await sql`
      SELECT
        to_regclass('public.email_otps') IS NOT NULL AS email_otps,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at') AS email_verified
    `;
    return Boolean(row?.email_otps && row?.email_verified);
  }

  if (id.startsWith("0003_")) {
    const [row] = await sql`
      SELECT
        to_regclass('public.password_resets') IS NOT NULL AS password_resets,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'password_resets_user_idx') AS user_index,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'password_resets_active_idx') AS active_index
    `;
    return Boolean(row?.password_resets && row?.user_index && row?.active_index);
  }

  if (id.startsWith("0004_")) {
    const [row] = await sql`
      SELECT count(*)::int AS count
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'conversations_user_workspace_updated_idx',
          'messages_conversation_created_idx',
          'memories_user_workspace_updated_idx',
          'uploads_workspace_created_idx',
          'sessions_user_active_idx',
          'usage_records_user_created_idx',
          'audit_logs_user_created_idx',
          'tasks_workspace_status_schedule_idx',
          'notifications_user_read_created_idx',
          'webhooks_workspace_enabled_idx'
        )
    `;
    return Number(row?.count ?? 0) === 10;
  }

  if (id.startsWith("0005_account_deletion")) {
    const [row] = await sql`
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'deleted_at') AS deleted_at
    `;
    return Boolean(row?.deleted_at);
  }

  if (id.startsWith("0006_tool_approvals")) {
    const [row] = await sql`
      SELECT
        to_regclass('public.tool_approvals') IS NOT NULL AS table_exists,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'tool_approvals_user_active_idx') AS user_index
    `;
    return Boolean(row?.table_exists && row?.user_index);
  }

  if (id.startsWith("0007_personal_workspace_unique")) {
    const [row] = await sql`
      SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'workspaces_personal_owner_unique') AS personal_index
    `;
    return Boolean(row?.personal_index);
  }

  return false;
}

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

    const files = (await readdir(migrationsDir))
      .filter((file) => /^(?:[1-9]\d*)_.*\.sql$/.test(file))
      .sort();

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

      if (await migrationAlreadySatisfied(sql, id)) {
        await sql`INSERT INTO bobai_migrations (id, checksum) VALUES (${id}, ${checksum})`;
        console.log(`recorded existing migration ${id}`);
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
