# BobAI feature setup checklist

This guide separates **code-side work** from the setup that must happen on your computer or in external provider accounts. A feature appearing in the UI does not mean its end-to-end behavior has been verified.

## 1. Install and start the project

1. Install Node.js 24 or newer and Git.
2. Open Command Prompt or PowerShell and go to the repository folder.
3. Pull the latest `main` branch:
   ```bash
   git pull origin main
   ```
4. Install the exact lockfile dependencies:
   ```bash
   npm ci
   ```
5. Create a local environment file if you do not already have one:
   - Command Prompt: `copy .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
6. Start BobAI:
   ```bash
   npm run ai
   ```
   The command runs the repository's configured `npm test` suite first. If any test fails, it stops and does not launch the services. If tests pass, it starts the API and web app and attempts to open `http://localhost:3000`. Keep the terminal open; press Ctrl+C to stop the services.
7. If the command stops at a failed test, fix that failure before trying again. Do not bypass failing tests to claim the app is verified.

## 2. Configure the database and accounts

1. Install and run PostgreSQL, or provision a PostgreSQL instance you control.
2. Create a dedicated database and a database user with only the permissions BobAI needs.
3. Put the connection string in your private `.env` as `DATABASE_URL=...`. Do not commit `.env`.
4. Review the DB workspace's documented migration process before applying schema changes. Use the repository's migration commands only after checking the target database and making a backup if it contains data.
5. Start BobAI and test health/readiness, account creation/login, session expiry, and conversation persistence.
6. Use test accounts and non-sensitive test data. Test that one account cannot access another account's conversations, files, or memories.

A database is not required for every isolated UI preview, but persistent accounts, conversations, memory, and other database-backed features cannot be considered working without a correctly migrated database.

## 3. Enable chat with an AI model

BobAI's documented public-beta AI path uses a hosted OpenAI-compatible provider; Ollama is not supported in this branch.

1. Choose a provider/model and review its pricing, data-processing terms, and age restrictions.
2. In the provider dashboard, set a hard spending cap and usage limits before making requests. Alerts alone may not stop spending.
3. In the private server environment, set:
   ```dotenv
   BOBAI_PROVIDER=openai
   OPENAI_API_KEY=your_server_side_key
   BOBAI_OPENAI_BASE_URL=https://api.openai.com/v1
   BOBAI_OPENAI_MODEL=gpt-4o-mini
   ```
4. Keep `OPENAI_API_KEY` server-side only. Never put it in a `NEXT_PUBLIC_*` variable, frontend code, screenshots, or Git.
5. Only after independently verifying the provider-side cap, set `BOBAI_PROVIDER_SIDE_BUDGET_CONFIGURED=true` and keep `BOBAI_PROVIDER_MONTHLY_BUDGET_INR=500` if that is the intended budget. This flag is an operator attestation, not an automatic check of the provider dashboard.
6. Restart BobAI and test model status, a short chat, streaming, stopping a response, and provider-error handling. Verify the selected model really supports each modality you plan to use.

Hosted chat, image generation, and other paid provider features may cost money. Do not test them until limits and pricing are understood.

## 4. Email OTP and account security

1. Set up an SMTP account/provider you are authorized to use.
2. Fill in `BOBAI_SMTP_HOST`, `BOBAI_SMTP_PORT`, `BOBAI_SMTP_USER`, `BOBAI_SMTP_PASSWORD`, and `BOBAI_SMTP_FROM` in the private environment.
3. Configure the MFA encryption key and any required terms/privacy settings according to the auth implementation and deployment environment.
4. Test sending and verifying a one-time code, invalid/expired codes, resend limits, sign-out, and session expiration.
5. Test account recovery and deletion only with test accounts. Confirm deletion/export behavior before storing real data.

Social login is optional. Google, GitHub, and Apple login also require credentials and callback URLs configured in each provider's dashboard; blank variables do not enable those providers.

## 5. Feature-by-feature configuration

| Feature | What you need to configure or verify |
|---|---|
| Chat + streaming | Hosted provider, server-side key, supported model, database if saving history; test stop/cancel and refresh persistence. |
| Conversation history | PostgreSQL, migrations, session authentication, ownership-isolation tests. |
| Long-term memory | Database/migrations, user consent and memory controls; test disable, clear, and per-user isolation. |
| File uploads and document understanding | Writable storage directory, upload size/type limits, OCR dependencies where required, malformed/oversized file tests, and cleanup/retention checks. |
| Image understanding (vision) | A configured model that actually accepts image inputs; test supported formats and provider errors. |
| Image generation/editing | Provider key and image-model access; test a real generated image, supported reference format/size, error handling, and usage cost. |
| Web search / research | Configure any required search/research provider settings in the relevant route/service; test citations against source evidence, broken links, empty results, and stale/conflicting information. |
| Voice dictation | Browser microphone permission and a configured/supported transcription path; test permission denial, noisy audio, and editing the transcript before sending. |
| Read answers aloud | Browser speech support or the configured speech provider/local executable paths; test stop/cleanup and missing-provider behavior. |
| Agents and tools | Keep tool execution disabled unless needed, configure agent secrets/URLs only for services you actually run, and verify approvals, quotas, cancellation, timeouts, and tenant isolation. |
| OAuth/social login | Provider dashboard credentials, exact callback URLs, allowed origins, and a private server environment. |
| Account export/deletion | Database/storage configured; test reauthentication, archive contents, grace period, and final removal with disposable accounts. |
| BobHS support service | Configure its host/port, mode, data directory, and strong controller/join/node tokens according to the service's deployment mode. It is separate from the normal web/API startup unless you explicitly start it. |
| Reminders, automations, integrations | Verify persistence, any required worker/scheduler, credentials for each integration, permission scopes, retries, and duplicate execution protection. |
| Theme and UI preferences | No external provider is normally needed; verify light/dark themes, mobile layout, keyboard navigation, and persisted settings. |

The names and exact requirements of environment variables can vary by feature. Use `.env.example` and the specific route/service implementation as the source of truth rather than inventing values.

## 6. Run the verification commands directly

Run these separately when diagnosing a failure:

```bash
npm test
npm run build
npm run smoke
npm run audit
```

- `npm test`: the automated tests configured in the root package scripts. It does not prove every UI flow or every external integration works.
- `npm run build`: builds the API, BobHS, and web workspaces.
- `npm run smoke`: repository smoke checks; inspect the script and its prerequisites before relying on the result.
- `npm run audit`: checks dependency advisories reported by npm; review any findings rather than blindly forcing dependency upgrades.

After each change, rerun the relevant tests. The `npm run ai` command runs the configured test suite before launching development services, but it does not currently run build, smoke, or audit automatically.

## 7. Before a public deployment

These are not code-only tasks:

- Choose hosting and a managed database; configure secrets in the hosting dashboard.
- Configure a real domain, HTTPS, allowed origins, secure cookies, backups, monitoring, and rollback.
- Set and verify provider-side spending limits.
- Publish accurate privacy/terms pages, operator and support contacts, provider/data-retention disclosures, and obtain appropriate legal guidance for the intended audience.
- Review every route for authorization, rate limiting, CORS/CSRF, input validation, and cross-account data isolation.
- Run a fresh-database migration test, an upgrade test, the full build/test/audit/smoke pass, and manual desktop/mobile checks.
- Do not claim a feature works until its live path has been exercised and its failure modes checked.

## What remains code-side

The repository's feature inventory marks multiple capabilities as implemented but unverified or partial. Remaining engineering work is to fix failures discovered by the tests/build, add missing UI and integration tests, verify database migrations and API route security, test cancellation and persistence end to end, and close the specific gaps listed in [the feature inventory](FEATURE_INVENTORY.md). Configuration steps above cannot replace those code changes or verification.
