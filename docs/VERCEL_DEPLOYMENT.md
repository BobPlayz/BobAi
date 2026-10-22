# Vercel deployment

The repo deploys as one Vercel project using **Vercel Services** (`vercel.json`): the Next.js website (`apps/web`) and the Express API (`apps/api`). The website sends `/api/*` to the API service.

## How a push to `main` deploys

- **Vercel Git integration** builds and deploys the website and API from every push (previews for other branches). It does **not** run database migrations.
- **GitHub Actions → "Deploy Jarvis to Vercel"** (`.github/workflows/vercel-deploy.yml`) builds, then runs `scripts/migrate.ts` against the production database, then deploys. If migrations fail, that workflow stops before deploying. It needs the `VERCEL_TOKEN` secret.
- Migrations only add tables, columns and indexes (`IF NOT EXISTS`); none drop or rewrite data.

## Project settings (Vercel dashboard)

- **Framework preset:** Services. **Root directory:** repository root.
- **Node.js version:** 22.x or 24.x (20.x is no longer accepted by Vercel). The API also declares `engines.node >= 22`.

## Environment variables (Production)

Required for the API to start (otherwise `/api/*` answers `503 misconfigured` and the deployment logs say which variable is missing):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon connection string. Use the **direct** (non-`-pooler`) host for migrations. |
| `CORS_ORIGIN` | Your site's exact HTTPS origin, e.g. `https://jarvis-x-ai-two.vercel.app` |
| `BOBAI_WEB_URL` | Same origin |
| `BOBAI_AUTH_REDIRECT_BASE_URL` | Same origin, no trailing slash |
| `BOBAI_AGENT_KEY` | Random secret, 32+ characters |
| `BOBAI_MFA_ENCRYPTION_KEY` | 64 hex characters (32 random bytes) |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Resend key and a sender on a **domain verified in Resend** (see below) |

For hosted chat, also follow [OLLAMA_GATEWAY.md](OLLAMA_GATEWAY.md): `BOBAI_OLLAMA_BASE_URL`, `BOBAI_OLLAMA_API_KEY`, `BOBAI_OLLAMA_MODEL`.

Optional: `BOBAI_CRICKET_API_KEY` (live cricket feed), `BOBAI_BRAVE_SEARCH_API_KEY` (better search), `BOBAI_MALWARE_SCANNER_URL` (otherwise set `BOBAI_MALWARE_SCAN_REQUIRED=false` to allow uploads without a scanner).

**Environment changes only apply to new deployments.** After editing variables: Deployments → latest → ⋯ → Redeploy.

## Email sign-in (Resend)

- Without a verified domain, Resend only delivers to the email address that owns the Resend account. Verify a domain (Resend → Domains) and use an address on it for `RESEND_FROM_EMAIL`, e.g. `Jarvis <login@yourdomain.com>`.
- Codes are 6 digits, expire after 10 minutes, are single use, allow 5 attempts, and are stored hashed.
- If sending fails, the API returns "could not send a verification code" and logs Resend's reason (never the code or the full email address).

## Checking a deployment

- `GET /api/health` → `{"status":"ok"}` when the API is running.
- `GET /api/ready` → yes/no checks: `databaseReachable`, `databaseSchemaReady`, `emailConfigured`, `modelReachable`. No secrets or hostnames are shown.
- If the API cannot start at all, `/api/*` answers `503` with `status: "startup_failed"` and a redacted one-line reason; full details are in Vercel → Deployments → Functions logs.

## What does not run on Vercel

- Ollama models (use the gateway), local voice (Piper/Whisper) and local image generation: these run on your own computer with `npm run ai`.
- Background workers (reminders, research briefs, maintenance) are skipped when `VERCEL=1`.
- Uploaded file bytes are stored in the function's temporary folder and are not kept between requests; extracted text and search chunks are saved in Postgres.

## Fixed problems (October 2026)

- The API crashed at startup on every route (`FUNCTION_INVOCATION_FAILED`): `pdf-parse` touched `DOMMatrix` when imported, which needs a canvas polyfill Vercel does not bundle. PDF and OCR libraries now load only when used.
- Uploads tried to create a folder in the read-only deployment directory at startup; they now use the temp folder.
- Requests arrived with the `/api` prefix and missed every route; the entry point now strips it.
- The first migration used the `vector` type before enabling pgvector, so a fresh database failed; early migrations are now idempotent.
