# Vercel deployment

The repo deploys as one Vercel project using **Vercel Services** (`vercel.json`): the Next.js website (`apps/web`) and the Express API (`apps/api`). The website sends `/api/*` to the API service.

## How a push to `main` deploys

- **Vercel Git integration** builds and deploys the website and API from every push (previews for other branches). It does **not** run database migrations.
- **GitHub Actions → "Deploy Jarvis to Vercel"** (`.github/workflows/vercel-deploy.yml`) builds, then runs `scripts/migrate.ts` against the production database, then deploys. If migrations fail, that workflow stops before deploying and the run summary shows the reason. It needs the `VERCEL_TOKEN` secret, and a `DATABASE_URL` repository secret when the Vercel variable is marked Sensitive (Vercel does not hand Sensitive values to `vercel pull`).
- Migrations only add tables, columns and indexes (`IF NOT EXISTS`); none drop or rewrite data.

## Project settings (Vercel dashboard)

- **Framework preset:** Services. **Root directory:** repository root.
- **Node.js version:** 22.x or 24.x (20.x is no longer accepted by Vercel). The API also declares `engines.node >= 22`.

## Environment variables (Production)

Set these in Vercel → Project → Settings → Environment Variables (Production), then redeploy.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `BOBAI_AGENT_KEY` | Random secret, 32+ characters |
| `BOBAI_OLLAMA_BASE_URL` | `https://ollama.com` (Ollama Cloud) or your gateway tunnel address |
| `BOBAI_OLLAMA_API_KEY` | Your Ollama Cloud API key (or the gateway token) |
| `BOBAI_EMAIL_PROVIDER` | `smtp` (or `resend`) |
| `BOBAI_SMTP_HOST` / `BOBAI_SMTP_PORT` | `smtp.gmail.com` / `465` |
| `BOBAI_SMTP_USER` / `BOBAI_SMTP_PASSWORD` | Your Gmail address / a Gmail **app password** |
| `BOBAI_SMTP_FROM` | `Jarvis <the same Gmail address>` |

No model name is needed: Jarvis discovers the models your Ollama endpoint offers and picks one per request (see [MODEL_ROUTING.md](MODEL_ROUTING.md)). `BOBAI_OLLAMA_MODEL` is an optional preference.

Do **not** copy `.env.example` into Vercel. On Vercel the API ignores localhost values: it uses the deployment's own address for `BOBAI_WEB_URL`, `BOBAI_AUTH_REDIRECT_BASE_URL` and `CORS_ORIGIN`, and switches to production mode once the settings above are valid. Delete `NODE_ENV` if it is set to `development`.

Optional: `BOBAI_MFA_ENCRYPTION_KEY` (64 hex characters; enables two-factor sign-in), `BOBAI_CRICKET_API_KEY` (live cricket feed), `BOBAI_BRAVE_SEARCH_API_KEY` (better search), `BOBAI_MALWARE_SCANNER_URL` (file uploads stay off in production until a scanner is set up).

## Login codes by email without owning a domain

Resend and most email APIs only deliver to other people from a domain you own, and they reject free public domains. Gmail's SMTP server sends from your Gmail address to anyone, for free (about 500 emails a day):

1. Turn on 2-Step Verification for the Gmail account.
2. Create an app password (Google Account → Security → App passwords). It is 16 letters; use it only as `BOBAI_SMTP_PASSWORD`.
3. Set the SMTP variables above and `BOBAI_EMAIL_PROVIDER=smtp`. Resend stays the default if `BOBAI_EMAIL_PROVIDER` is not set.

Codes are 6 digits, expire after 10 minutes, are single use, allow 5 attempts, are stored hashed, and are never logged. One email per address per minute, 10 requests per address per 15 minutes.



## Frequent reminder scheduling on Vercel Hobby

Vercel Hobby cron jobs are limited to one run per day. Jarvis now includes a separate free GitHub Actions scheduler that calls the reminder endpoint every five minutes, without using Vercel cron execution:

1. In Vercel → Project → Settings → Environment Variables, add `CRON_SECRET` as a **Sensitive** Production variable with a long random value. Keep it private.
2. In GitHub → repository Settings → Secrets and variables → Actions, add a repository secret with the exact same name, `CRON_SECRET`, and the exact same value.
3. Redeploy the Vercel project after the build quota is available.
4. In GitHub → Actions, enable workflows if prompted, then open **Jarvis reminder scheduler**. Use **Run workflow** once to test it.
5. Check the workflow run. A successful endpoint response is HTTP 200 with `{ "ok": true }`.

The workflow is `.github/workflows/reminder-scheduler.yml` and runs every five minutes on the default branch. GitHub may delay scheduled runs, so this is not an exact real-time guarantee. The built-in Vercel daily cron remains as a backup. The endpoint is safe to call repeatedly because reminder rows are claimed transactionally before a notification is inserted. It creates in-app notifications only; it does not send email or push notifications.

If you prefer an external scheduler, cron-job.org can call `https://jarvis-x-ai-two.vercel.app/api/cron/reminders` with the same `Authorization: Bearer <CRON_SECRET>` header.

## Checking a deployment

- `GET /api/health` → `{"status":"ok"}` when the API is running.
- `GET /api/ready` → yes/no checks for the database, email (`emailProvider`), the model (`modelReachable`, plus `modelProblem`: `not_configured`, `auth`, `model_missing`, `unreachable`, ...), production mode, and the *names* of missing settings. No secrets or hostnames are shown.
- If the API cannot start at all, `/api/*` answers `503` with `status: "startup_failed"` and a redacted one-line reason; full details are in Vercel → Deployments → Functions logs.

## Getting found on Google and by AI assistants

Nobody can force Google or an AI to recommend a site, but these steps make sure they can find, read and trust it:

1. **Google:** open [Google Search Console](https://search.google.com/search-console), add the URL-prefix property
   `https://jarvis-x-ai-two.vercel.app`, choose **HTML tag**, and copy only the `content="..."` value into the Vercel
   variable `GOOGLE_SITE_VERIFICATION`. Redeploy, press **Verify**, then under **Sitemaps** submit `sitemap.xml`.
2. **Bing** (also feeds ChatGPT search, Copilot and DuckDuckGo): open [Bing Webmaster Tools](https://www.bing.com/webmasters),
   choose **Import from Google Search Console** (easiest), or use the meta tag with `BING_SITE_VERIFICATION`, then submit the sitemap.
3. AI assistants read `/llms.txt` (a plain summary of Jarvis) and the structured data on the home page. `robots.txt`
   lets every search and AI crawler read the public pages; chats, settings and accounts stay private.
4. Links help most: put the URL in your GitHub repo's About box, your school project write-up, and anywhere you share it.

## What does not run on Vercel

- Ollama models (use the gateway), local voice (Piper/Whisper) and local image generation: these run on your own computer with `npm run ai`.
- Background workers (reminders, research briefs, maintenance) are skipped when `VERCEL=1`.
- Uploaded file bytes are stored in the function's temporary folder and are not kept between requests; extracted text and search chunks are saved in Postgres.

## Fixed problems (October 2026)

- The API crashed at startup on every route (`FUNCTION_INVOCATION_FAILED`): `pdf-parse` touched `DOMMatrix` when imported, which needs a canvas polyfill Vercel does not bundle. PDF and OCR libraries now load only when used.
- Uploads tried to create a folder in the read-only deployment directory at startup; they now use the temp folder.
- Requests arrived with the `/api` prefix and missed every route; the entry point now strips it.
- The first migration used the `vector` type before enabling pgvector, so a fresh database failed; early migrations are now idempotent.
