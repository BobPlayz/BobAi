# Vercel deployment

This repository is a monorepo. The root `vercel.json` routes the Next.js app and Express API through Vercel Services. In the Vercel project settings, select **Services** as the framework if that option is available for your account. Services are currently a Vercel beta feature; if your account does not have access, deploy `apps/web` and `apps/api` as separate Vercel projects instead.

## Minimum production environment

Do not import the full `.env.example`. Start with these values in Vercel Project Settings → Environment Variables:

- `NODE_ENV=production`
- `DATABASE_URL`: hosted PostgreSQL connection string (Neon is supported)
- `CORS_ORIGIN`: exact HTTPS origin of the deployed app, e.g. `https://your-project.vercel.app`
- `BOBAI_WEB_URL`: same deployed HTTPS origin
- `BOBAI_AUTH_REDIRECT_BASE_URL`: same origin without a trailing slash
- `BOBAI_AGENT_KEY`: generate a random secret of at least 32 characters
- `BOBAI_MFA_ENCRYPTION_KEY`: random 32-byte key encoded as 64 hex characters
- `BOBAI_TERMS_VERSION`: date in `YYYY-MM-DD` format
- `BOBAI_TERMS_URL`: public HTTPS URL to the terms page
- `BOBAI_PRIVACY_URL`: public HTTPS URL to the privacy page
- `BOBAI_LEGAL_CONTACT`: monitored contact address
- `BOBAI_LEGAL_REVIEWED=true`: only after the production legal pages have actually been reviewed
- `BOBAI_ADMIN_EMAILS`: comma-separated valid admin email address(es)
- `BOBAI_DISTRIBUTED_RATE_LIMIT=true`: required only when the configured distributed rate-limit backend is ready
- Email delivery: either `RESEND_API_KEY` + `RESEND_FROM_EMAIL`, or `BOBAI_SMTP_HOST` + `BOBAI_SMTP_FROM`

Use real secrets and values in Vercel, never commit them to Git. Do not set placeholder legal URLs or mark legal review complete just to make a deployment pass. Production startup intentionally fails when required security, legal, database, or email settings are missing.

## Features not available in a serverless deployment

- Vercel sets `VERCEL=1`; the API no longer starts recurring maintenance, automation, reminder, or research workers in that environment. Those jobs need a separate always-on worker or scheduled job before relying on them in production.
- Ollama, local model files, local Piper/Whisper assets, and local Diffusers image generation are not hosted by Vercel. Local-only AI features need a separately reachable model host or should remain disabled.
- Confirm uploads and generated media use durable object storage. Do not rely on the serverless filesystem for persistent files.
- Streaming, long-running inference, large request bodies, database extensions, auth redirects, and email delivery require live deployment checks.

## Deploy

1. Import `BobPlayz/BobAi` into Vercel and select the `main` branch.
2. Configure the framework as Services if available, and leave the project root at the repository root.
3. Add only the production variables listed above that match the features you have configured.
4. Deploy, then check `/` and `/api` and test sign-in, email delivery, database-backed chat, file uploads, and streaming.
5. If Services is unavailable, create separate Vercel projects with root directories `apps/web` and `apps/api`. Configure the API's URL in the frontend using the project's existing API base URL setting and set the API CORS origin to the frontend URL.

A successful build is not proof that the complete application is production-ready. Verify all feature integrations on the deployed URLs.
