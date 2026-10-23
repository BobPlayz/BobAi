# Database Guide

Schema design, migrations, and operational conventions for Jarvis's PostgreSQL database.

## Purpose

The database stores application records such as users, workspaces, conversations, messages, memories, projects, settings, tasks, tools, and agent runs. The authoritative schema is in `packages/db/src/schema/`.

## Database stack

- PostgreSQL is the primary database.
- Drizzle ORM defines and queries application data.
- The `@bobai/db` workspace exports the database client and schema.
- Neon can be used as a hosted PostgreSQL provider; deployment configuration is supplied through environment variables.

## Setup

1. Provision a PostgreSQL database.
2. Set `DATABASE_URL` in the local environment or deployment secret store.
3. Install dependencies with `npm ci`.
4. Generate migrations when schema changes are made: `npm run db:generate`.
5. Apply migrations with `npm run db:migrate` (`scripts/migrate.ts`).
6. Verify the application against the migrated database before deployment.

Do not commit local environment files or real database credentials.

## Schema design principles

- Keep tables normalized and use explicit relations.
- Use the existing schema modules and naming conventions before adding new tables.
- Add indexes for frequently queried and joined fields when supported by query patterns.
- Use foreign keys and appropriate deletion behavior for owned records.
- Keep user- and workspace-owned data scoped in queries; never rely on a client-supplied owner ID.
- Store timestamps consistently and make migration behavior explicit.

## Naming conventions

- Table names use the conventions already present in the schema modules.
- TypeScript schema properties use camelCase.
- Database identifiers should be descriptive and consistent with adjacent tables.
- Avoid reserved SQL keywords and unexplained abbreviations.

## Migrations and seeding

- Make schema changes through migrations, not manual production edits.
- Keep migrations small, reviewable, and safe to run more than once where practical.
- Review generated SQL before applying it.
- Use synthetic data for local development and tests.
- Do not put real user data or secrets in seed files.

## Connection management

The database client reads `DATABASE_URL` and supports bounded pool controls through `DB_POOL_MAX`, `DB_IDLE_TIMEOUT_SECONDS`, `DB_CONNECT_TIMEOUT_SECONDS`, and `DB_MAX_LIFETIME_SECONDS`. Defaults and bounds are defined in `packages/db/src/index.ts`.

## Backup and recovery

Use the repository's database backup and verification scripts. Test restoration in a non-production environment and document the recovery point and recovery time expectations for each deployment.


## How migrations run

- `scripts/migrate.ts` applies the SQL files in `drizzle/` in order inside a lock, records each one with a checksum in `bobai_migrations`, and refuses to continue if an applied migration was changed (a difference in line endings only, from a Windows checkout, is accepted).
- Early migrations are idempotent (`IF NOT EXISTS`), so a fresh database and an existing one both migrate cleanly. Nothing drops or rewrites data.
- On push to `main`, the "Deploy Jarvis to Vercel" GitHub workflow runs migrations against production (using the `DATABASE_URL` repository secret) before deploying. A failure shows its reason on the run page without exposing the connection string.

## Verified

A fresh database migrates from zero and re-runs cleanly; the production database migrates through the workflow (October 2026). Chat history, memory, sessions and per-user isolation are covered by `npm run e2e`. A backup restore drill has not been done.
