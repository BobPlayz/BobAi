# BobAI — living production roadmap

last updated: 2026-08-28
base reviewed: `main` at `a89077f`
ui status: **FROZEN** — no UI/layout/visual redesign work is included in this roadmap unless Bob explicitly asks for it.

## status legend

- [x] done in code/repository
- [~] implemented, but requires real-environment verification
- [ ] engineering work remaining
- [USER] requires Bob's account, secret, domain, hosting, hardware, or explicit product decision
- [BLOCKED] cannot be honestly completed until a [USER] dependency exists

---

# 0. confirmed project state

## confirmed from the project chat

- [x] local Ollama is running
- [x] `qwen2.5:3b` works
- [x] `qwen2.5:7b` works
- [x] `qwen2.5-coder:1.5b` works
- [x] `qwen2.5-coder:latest` works
- [x] API runs on `http://localhost:3001`
- [x] Next.js web runs on `http://localhost:3000`
- [x] email provider/SMTP development setup works
- [x] OTP email delivery works
- [x] OTP verification works
- [x] database schema push eventually succeeded after the missing `vector` type issue was resolved
- [x] `npm test` passed with the existing security tests
- [x] `npm run build` passed for API and web
- [x] the `/chat` undefined `activeConversation.messages` crash was fixed
- [x] hydration mismatch encountered on `/chat` was fixed
- [x] registration is wired to the API
- [x] authenticated API requests and refresh handling are wired into the web client

## confirmed from repository inspection

- [x] npm-workspaces monorepo with `apps/api`, `apps/web`, and `packages/db`
- [x] Express API with centralized auth middleware
- [x] Next.js/React web app
- [x] PostgreSQL + Drizzle schema
- [x] pgvector schema groundwork
- [x] users, sessions, workspaces, workspace members, conversations, messages, memories, memory embeddings, uploads, projects, agents, agent runs, tasks, audit logs, usage, notifications, integrations, model providers, workflows, webhooks, billing/subscription groundwork, OTPs, and password-reset tables exist
- [x] access and refresh tokens are stored as hashes
- [x] refresh-token rotation/revocation exists
- [x] account session management exists
- [x] password reset backend exists
- [x] OTP sender is abstracted so the email provider can be replaced later
- [x] Ollama health/readiness and installed-model discovery exist
- [x] capability-aware model routing exists
- [x] Alex/Ben/Ryan roles exist
- [x] coding-agent detection/orchestration exists
- [x] conversation persistence endpoints exist
- [x] file upload and PDF/text extraction exist
- [x] image-generation endpoint and media provider abstraction exist
- [x] streaming endpoint exists
- [x] production configuration validation exists
- [x] CORS restrictions, security headers, request IDs, body limits, and rate limiting exist
- [x] CI/build/test scripts exist
- [x] provider-agnostic research/web-search bridge exists and is disabled until configured
- [x] Ollama vision bridge exists and is disabled until a vision model is configured
- [x] password hashing was reduced from the previous oversized scrypt memory setting so the local registration path can operate on the available machine
- [x] focused auth rate limiting now covers registration, login, OTP request, and OTP verification
- [x] conversation persistence now resolves a personal workspace automatically and stores complete message snapshots including attachments
- [x] memory routes no longer trust a client-supplied user ID
- [x] normal chat now reads stored memories and writes explicit memory requests to the database

---

# 1. foundation and architecture

## done

- [x] monorepo structure
- [x] TypeScript base configuration
- [x] API/web/database package separation
- [x] shared schema exports
- [x] environment templates
- [x] development launcher
- [x] build/test/audit scripts
- [x] CI workflow
- [x] production environment validation

## remaining code-side

- [ ] replace production `db:push` workflow with versioned migrations
- [ ] add migration-only deployment command
- [ ] add deterministic release/rollback procedure
- [ ] add production smoke-test command
- [ ] add backup/restore documentation and verification script
- [ ] add dependency vulnerability triage
- [ ] remove unnecessary dependencies where possible
- [ ] pin/lock critical production dependency behavior

## user required

- [USER] production database/account and deployment credentials

---

# 2. authentication, OTP and account security

## done

- [x] registration
- [x] login
- [x] short-lived access token
- [x] long-lived refresh token
- [x] refresh rotation
- [x] logout/revocation
- [x] session listing and individual/all-session revocation
- [x] password reset token storage and consumption
- [x] password reset revokes active sessions
- [x] six-digit OTP generation
- [x] OTP expiry
- [x] OTP maximum attempts
- [x] OTP single-use consumption
- [x] OTP sender abstraction
- [x] development Resend delivery
- [x] global API rate limiting
- [x] focused registration/login/OTP rate limits
- [x] security headers and request IDs
- [x] production secret validation

## remaining engineering

- [ ] cleanup expired OTP/password-reset rows
- [ ] login/session audit events
- [ ] stronger adaptive brute-force protection
- [ ] production password-reset email delivery through the same sender abstraction
- [ ] decide and enforce which actions require verified email
- [ ] implement complete account deletion worker
- [ ] expand account export to all owned application data
- [ ] add authentication integration tests for success/failure/rotation/OTP abuse

## user required

- [USER] production Resend/API credential
- [USER] production sender/domain configuration if the development sender is replaced
- [USER] final decision on whether email verification is mandatory or optional for launch

---

# 3. database, workspace and persistence

## done

- [x] PostgreSQL/Drizzle integration
- [x] vector schema support
- [x] auth persistence
- [x] workspace and workspace-member schema
- [x] conversation/message schema
- [x] server conversation API
- [x] automatic personal-workspace resolution for normal conversation/memory operations
- [x] server conversation snapshot persistence
- [x] attachment persistence in message metadata
- [x] authenticated ownership checks

## remaining engineering

- [ ] add deterministic unique constraints for personal workspace membership where appropriate
- [ ] add indexes for user/workspace/conversation/message queries
- [ ] add offline/local-to-server reconciliation rules
- [ ] add conflict handling for multi-device edits
- [ ] add retention policies
- [ ] add database migration files
- [ ] add backup/restore verification
- [ ] add connection pool tuning
- [ ] add production database observability

## user required

- [USER] production Neon/PostgreSQL database
- [USER] production `DATABASE_URL`

---

# 4. web chat state and server-backed conversations

## done

- [x] local conversation creation
- [x] new chat
- [x] search
- [x] selection
- [x] local pin/rename/delete/message controls
- [x] server conversation list API
- [x] server conversation save API
- [x] server conversation delete API
- [x] web client authenticated persistence helpers
- [x] web hook restores server conversations after login
- [x] local conversations are used as a fallback when the backend is unavailable
- [x] local changes are synchronized back to the server without changing the UI

## remaining engineering

- [ ] persist streamed assistant messages atomically after stream completion
- [ ] persist cancellation/failed-message status
- [ ] improve offline reconciliation instead of simple fallback
- [ ] cross-device conflict resolution
- [ ] server-side conversation search for large accounts
- [ ] pagination for very large conversation histories
- [ ] message editing/regeneration persistence semantics

## note

The UI is intentionally untouched. These items are data/state engineering only.

---

# 5. chat engine and model routing

## done

- [x] normal Ollama chat
- [x] streaming chat
- [x] model registry
- [x] capability metadata
- [x] installed-model discovery
- [x] health checks
- [x] availability checks
- [x] timeouts
- [x] capability-safe fallback
- [x] local Qwen 3B
- [x] local Qwen 7B
- [x] local Coder 1.5B
- [x] local Coder latest
- [x] Alex → Qwen 3B
- [x] Ben → Coder latest
- [x] Ryan → Qwen 3B
- [x] coding-intent detection

## remaining engineering

- [ ] formal provider interface for hosted/cloud models
- [ ] provider credential abstraction
- [ ] provider retry/backoff policies
- [ ] circuit breaker/provider health recovery
- [ ] request cancellation propagation
- [ ] context/token budgeting
- [ ] structured generation validation
- [ ] per-user/model/provider usage accounting
- [ ] privacy-safe model telemetry
- [ ] embeddings provider abstraction
- [ ] hosted inference provider integration

## user required

- [USER] production inference provider/capacity
- [USER] public AI backend reachable by production API

important: local Ollama on Bob's laptop is a development model host, not a production backend for a school audience.

---

# 6. memory and personalization

## done

- [x] memory schema
- [x] memory write endpoint
- [x] memory read endpoint
- [x] memory clear endpoint
- [x] explicit memory detection
- [x] authenticated user isolation
- [x] personal workspace fallback
- [x] memory context injection into normal chat
- [x] explicit memory persistence from normal chat

## remaining engineering

- [ ] inject memory context into streaming chat
- [ ] generate real embeddings
- [ ] vector similarity retrieval
- [ ] relevance scoring
- [ ] recency weighting
- [ ] memory deduplication/update
- [ ] memory expiration policy
- [ ] privacy classification before storage
- [ ] sensitive-memory policy
- [ ] memory audit history
- [ ] memory isolation integration tests
- [ ] export/delete coverage

## user required

- [USER] only required when a real external embedding/AI provider is selected

---

# 7. files and document pipeline

## done

- [x] authenticated uploads
- [x] upload progress in web client
- [x] 10 MB request file limit
- [x] MIME/type checks
- [x] PDF signature validation
- [x] PDF text extraction
- [x] text/markdown/csv/html/css/javascript/xml extraction
- [x] basic image upload recognition
- [x] temporary-file cleanup
- [x] message attachment persistence groundwork

## remaining engineering

- [ ] production object storage abstraction with durable storage
- [ ] Cloudflare R2/S3-compatible implementation
- [ ] upload checksum verification
- [ ] malware scanning integration point
- [ ] document chunking
- [ ] document indexing
- [ ] semantic document retrieval
- [ ] ownership/isolation tests
- [ ] file retention/deletion worker
- [ ] extraction worker for large documents
- [ ] OCR execution using the installed Tesseract dependency
- [ ] durable generated-media storage

## user required

- [USER] production object-storage account/credentials if R2/S3 is used

---

# 8. vision, image, video, voice and music

## done

- [x] image-generation route
- [x] local media-provider abstraction
- [x] video-generation contract groundwork
- [x] voice provider abstraction
- [x] music provider abstraction/route groundwork
- [x] Ollama vision endpoint code
- [x] vision input size validation

## remaining engineering

- [ ] connect the web chat to vision without changing UI structure
- [ ] validate vision model capabilities before use
- [ ] add provider health/readiness for multimodal providers
- [ ] add image output persistence
- [ ] add video job persistence
- [ ] add voice transcription provider
- [ ] add voice synthesis provider
- [ ] add music provider
- [ ] add media content safety/policy layer
- [ ] add media retention cleanup

## user required

- [USER] vision model installed/configured if Ollama vision is used
- [USER] external image/video/voice/music provider credentials if external providers are chosen

---

# 9. web search / research

## done

- [x] provider-agnostic research service
- [x] authenticated `/research/search` endpoint
- [x] query length validation
- [x] HTTPS requirement for production providers
- [x] timeout handling
- [x] provider can be replaced without changing the public API

## remaining engineering

- [ ] connect an actual search provider
- [ ] normalize search results into a stable BobAI result schema
- [ ] citations/source metadata model
- [ ] result ranking/deduplication
- [ ] search caching
- [ ] provider failure fallback
- [ ] prompt-injection isolation for retrieved web content
- [ ] per-user search rate limits

## user required

- [USER] actual search provider choice and credential/API key

---

# 10. coding agents and autonomous execution

## done

- [x] Bob remains the only user-facing agent
- [x] Alex planner
- [x] Ben coder
- [x] Ryan reviewer
- [x] model assignments
- [x] coding intent detection
- [x] task queue groundwork
- [x] retry count
- [x] coding-agent bridge
- [x] internal agent messages/status architecture
- [x] authenticated agent endpoints

## remaining engineering

- [ ] durable database-backed queue
- [ ] worker restart recovery
- [ ] real filesystem execution hardening
- [ ] workspace sandbox
- [ ] path traversal protection
- [ ] process CPU/memory/time limits
- [ ] command allow/deny policy
- [ ] checkpoint/rollback
- [ ] patch/diff validation
- [ ] structured agent output validation
- [ ] persistent agent-run history
- [ ] cancellation
- [ ] workspace-scoped permissions
- [ ] audit log for every mutation
- [ ] disposable-workspace end-to-end tests

## user required

- [USER] coding-agent bridge/workspace location
- [USER] coding-agent credential if a bridge is used
- [USER] explicit production filesystem permission policy

---

# 11. tools and automation

## done

- [x] tool schema groundwork
- [x] tool log schema
- [x] integrations schema
- [x] webhook schema
- [x] automation route/schema groundwork
- [x] notification schema

## remaining engineering

- [ ] strict tool registry
- [ ] tool input/output schemas
- [ ] per-tool permissions
- [ ] timeout/idempotency/retry semantics
- [ ] result size limits
- [ ] tool audit logging
- [ ] scheduled job worker
- [ ] webhook signature verification
- [ ] webhook replay protection
- [ ] notification provider implementation

## user required

- [USER] external integration credentials only for integrations Bob chooses to activate

---

# 12. production security and reliability

## done

- [x] authentication middleware
- [x] agent authentication middleware
- [x] admin identity checks
- [x] explicit production CORS
- [x] HTTPS-only production origins
- [x] security headers
- [x] HSTS
- [x] request IDs
- [x] JSON body limits
- [x] global rate limiting
- [x] focused auth rate limits
- [x] hidden internal errors in production
- [x] production env validation
- [x] proxy trust validation
- [x] security integration tests

## remaining engineering

- [ ] distributed rate limiter for multiple API instances
- [ ] centralized structured logging
- [ ] error monitoring
- [ ] alerting
- [ ] uptime monitoring
- [ ] graceful shutdown
- [ ] database pool tuning
- [ ] liveness/readiness separation
- [ ] upload-specific abuse controls
- [ ] secret rotation process
- [ ] dependency vulnerability remediation
- [ ] incident-response runbook
- [ ] production load tests

---

# 13. production deployment

## code-side preparation

- [x] configurable `NEXT_PUBLIC_API_URL`
- [x] production web build
- [x] production API config validation
- [x] health endpoint
- [x] readiness endpoint
- [ ] Cloudflare-compatible deployment configuration
- [ ] API-host deployment configuration
- [ ] production migration command
- [ ] deployment smoke test
- [ ] rollback documentation

## user required

- [USER] Cloudflare account/project
- [USER] domain/DNS access
- [USER] public frontend hostname
- [USER] public API hostname
- [USER] production API hosting account/project
- [USER] production environment variables/secrets

---

# 14. 2k+ school-visitor readiness

The public launch target is not "the website loads". It is "the website remains usable when many students arrive at once."

## must be completed before announcement

- [ ] hosted AI inference available
- [ ] production PostgreSQL with backups
- [ ] durable job queue/worker if agents are enabled publicly
- [ ] distributed rate limiting
- [ ] abuse protection
- [ ] monitoring and alerting
- [ ] error tracking
- [ ] realistic concurrent-chat load test
- [ ] registration/login load test
- [ ] OTP load/abuse test
- [ ] streaming-through-Cloudflare test
- [ ] database connection-pressure test
- [ ] file-upload abuse test
- [ ] provider outage/fallback test
- [ ] confirm no public request depends on Bob's local laptop
- [ ] confirm API and frontend can recover from restarts

## user required

- [USER] final expected concurrent users
- [USER] hosting/inference capacity decision
- [USER] public domain/URL
- [USER] launch date/time

---

# 15. testing matrix

## already confirmed

- [x] TypeScript API build
- [x] Next.js production build
- [x] security tests
- [x] local Ollama model smoke tests
- [x] local OTP delivery/verification
- [x] database schema push

## remaining engineering

- [ ] auth success/failure integration suite
- [ ] OTP abuse/expiry tests
- [ ] refresh-token rotation tests
- [ ] conversation ownership tests
- [ ] workspace isolation tests
- [ ] memory isolation tests
- [ ] file ownership tests
- [ ] model fallback tests
- [ ] streaming disconnect tests
- [ ] agent retry/failure tests
- [ ] webhook signature tests
- [ ] production configuration validation tests
- [ ] migration tests
- [ ] load tests
- [ ] end-to-end browser test suite

## user/environment verification

- [USER] local runtime pass after pulling latest code
- [USER] production smoke test after deployment
- [USER] real provider verification after credentials are installed

---

# 16. UI work — explicitly owned by Bob

**no UI changes are being made by the code-side production pass.**

Bob owns:

- [USER] chat UI redesign
- [USER] frontend bug/visual fixes
- [USER] final UI polish
- [USER] final layout/proportions/spacing
- [USER] glass/neural visual tuning
- [USER] final theme visuals
- [USER] final reference-accurate styling
- [USER] final animation/interaction polish

These are intentionally excluded from engineering work until Bob requests them.

---

# 17. final user-required checklist

These are the things Bob actually has to supply/do. Everything else should be treated as engineering work and finished in code first.

- [USER] production Neon/PostgreSQL
- [USER] production database URL
- [USER] production email/Resend credential and sender/domain decision
- [USER] production AI inference provider or publicly reachable inference host
- [USER] production AI credentials where required
- [USER] Cloudflare account/project
- [USER] domain/DNS access
- [USER] API hosting account/project
- [USER] production object storage credentials if enabled
- [USER] search provider/API key if enabled
- [USER] vision model/provider if enabled
- [USER] voice provider if enabled
- [USER] video/music providers if enabled
- [USER] coding-agent bridge/workspace/key if enabled
- [USER] production secret generation and installation
- [USER] final public URL
- [USER] final launch/concurrency decision
- [USER] final local and production smoke tests

---

# 18. production definition of done

BobAI is **production ready** when all of the following are true:

1. API and web builds pass.
2. Automated security/integration tests pass.
3. Database migrations apply cleanly to a fresh production database.
4. Authentication, refresh, OTP, logout, and password reset work against production services.
5. Conversations survive API/web restarts and login from another device.
6. Memory is isolated per user/workspace and retrieval is tested.
7. Files use durable storage and ownership checks.
8. AI inference is hosted/reachable without Bob's laptop.
9. Streaming works through the production proxy.
10. Rate limiting and abuse controls work across production instances.
11. Monitoring, error tracking, and alerts are active.
12. Backups exist and restore has been verified.
13. Agent execution is sandboxed or disabled for public users until it is safe.
14. Cloudflare/frontend deployment and API deployment both pass smoke tests.
15. A realistic concurrency/load test passes for the expected school traffic.
16. Bob has completed the remaining [USER] checklist.
17. UI is considered complete by Bob separately; the engineering roadmap does not silently modify it.

---

# living-roadmap rule

This file is the source of truth for BobAI engineering status. Whenever code is changed, update the relevant checklist/status here. Do not mark environment-dependent work as done merely because the code exists. Do not mark UI work as done during backend/production engineering unless Bob explicitly asks for UI work.
