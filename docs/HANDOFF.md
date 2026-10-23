# Jarvis handoff

**Updated:** 2026-10-23 · **Repository:** https://github.com/BobPlayz/BobAi · **Branch:** `main` only · **Live:** https://jarvis-x-ai-two.vercel.app

## Ground rules

- Work directly on `main`; never force-push or rewrite history.
- Ollama is the only AI provider (no OpenAI, OpenRouter, Anthropic or ComfyUI). No paid services without the owner's approval.
- Never expose secrets, never fake results, and say clearly what was tested for real versus with mocks.
- Keep the UI age-appropriate and casual; the owner is a Class 8 student.

## Architecture

| Area | Where | Notes |
| --- | --- | --- |
| Website | `apps/web` (Next.js 16.4.2, React 19) | Landing, login, onboarding, chat, settings, demo, legal pages. Theme tokens in `globals.css` |
| API | `apps/api` (Express 5) | Vercel entry `src/app.ts` loads `application.ts` lazily, strips the `/api` prefix, applies hosted defaults |
| Model routing | `services/modelInventory.ts`, `modelHealth.ts`, `modelRouter.ts`, `ollamaProvider.ts` | Discovers models, picks per task, falls back safely. See [MODEL_ROUTING.md](MODEL_ROUTING.md) |
| Chat | `routes/stream.ts`, `services/chatEngine.ts` | SSE streaming, live data (weather, cricket), tool loop with approvals, memory, history persistence |
| Auth | `routes/auth.ts`, `services/otp.ts`, `otpDelivery.ts`, `email.ts` | Email codes over Gmail SMTP or Resend (Resend falls back to SMTP). See [QUICK_START_AUTH.md](QUICK_START_AUTH.md) |
| Gateway | `apps/ollama-gateway` | Lets the hosted site use Ollama on a PC safely. See [OLLAMA_GATEWAY.md](OLLAMA_GATEWAY.md) |
| Database | `packages/db`, `drizzle/`, `scripts/migrate.ts` | Neon Postgres; migrations run in the deploy workflow. See [DATABASE.md](DATABASE.md) |
| Local media | `scripts/local_image_generation.py`, Piper, faster-whisper | PC only; not available on Vercel |

## Deployment

Vercel Git integration deploys every push to `main`; the "Deploy Jarvis to Vercel" workflow also runs migrations (with the `DATABASE_URL` repository secret) and deploys. Settings: [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md). `GET /api/ready` reports production mode, database, email providers, model discovery and per-task model picks.

## Verified (October 2026)

- **Automated:** type checks, lint (0 warnings), builds, and 5 test suites (110+ API tests including model routing, fallback, provider errors, email provider choice and hosted defaults).
- **Laptop end to end (`npm run e2e`, real Postgres + Ollama):** sign-in, wrong/reused codes, refresh, logout, streaming chat through automatic routing, history order after reload, memory (including history), weather, uploads, Alan voice, per-user isolation. SMTP delivery for two testers against a local TLS mail server; Resend refusal falling back to SMTP.
- **Real provider checks:** discovery of the Ollama Cloud catalogue (22 models, metadata only); a real gateway refusing a model handled cleanly.
- **Live:** production mode, migrations, database, Ollama Cloud key and discovery all report ready.

## Not verified yet

- A real chat on the live site and real Gmail delivery (needs signing in with a real inbox).
- Which Ollama Cloud models the free plan allows (learned automatically at runtime).
- Live web research, cricket and image understanding inside a signed-in chat.

## Known limits

- Uploads on the live site need a malware scanner (`BOBAI_MALWARE_SCANNER_URL`); they are refused without one by design.
- Voice and image generation run only on a PC.
- Model health (speed, refusals) is kept in memory per server instance, so a fresh Vercel instance may hit one or two instant plan refusals before settling.
- Several API features (reminders, projects, saved prompts, deep research, study packs, global search) have endpoints but no screens in the website yet.
