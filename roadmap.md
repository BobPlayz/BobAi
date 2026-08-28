# BobAI — living production roadmap

last updated: 2026-08-28
current branch: main
current head: 153fc2921d4031186e34098eb12d3551c2b3a45e
ui status: FROZEN — do not modify UI/layout/visual styling unless explicitly requested by Bob

## status legend

- [x] done and confirmed in repository
- [~] implemented but needs real-environment verification
- [ ] remaining engineering work
- [USER] requires Bob's account, secret, domain, hosting, hardware, or explicit product decision
- [BLOCKED] cannot honestly be completed until a [USER] item exists

---

# 0. current state snapshot

## confirmed working from the project chat

- [x] local Ollama is running
- [x] `qwen2.5:3b` responds
- [x] `qwen2.5:7b` responds
- [x] `qwen2.5-coder:1.5b` responds
- [x] `qwen2.5-coder:latest` responds
- [x] API starts on `http://localhost:3001`
- [x] Next.js web starts on `http://localhost:3000`
- [x] email OTP delivery works
- [x] email OTP verification works
- [x] database schema was successfully pushed after enabling the required vector type
- [x] security tests pass
- [x] production build passes
- [x] the initial `/chat` active-conversation crash was fixed
- [x] authentication registration is wired to the API
- [x] authenticated API requests and hydration issues were fixed

## confirmed by repository inspection

- [x] monorepo with `apps/api`, `apps/web`, and `packages/db`
- [x] Express API with centralized routing and authentication middleware
- [x] PostgreSQL + Drizzle schema with users, sessions, conversations, messages, memories, files/uploads, agents, tasks, audit logs, notifications, integrations, model providers, OTPs, password resets, billing/subscription groundwork, and related tables
- [x] access-token + refresh-token sessions are stored as hashes
- [x] refresh-token rotation/revocation exists
- [x] account session management exists
- [x] password reset backend exists
- [x] Resend is isolated behind an OTP sender interface so the email provider can be replaced later
- [x] Ollama health/readiness and installed-model discovery exist
- [x] model capability metadata and centralized model routing exist
- [x] Alex/Ben/Ryan model roles exist
- [x] coding-task detection and agent orchestration exist
- [x] server-side conversation persistence endpoints exist
- [x] file upload and PDF/text extraction groundwork exists
- [x] memory storage/retrieval groundwork exists
- [x] image generation endpoint exists
- [x] streaming endpoint exists
- [x] production configuration validation exists
- [x] CORS restrictions, security headers, request IDs, JSON size limits, and rate limiting exist
- [x] API and web production builds are part of the root build command
- [x] GitHub CI now validates install, build, tests, and database schema generation
- [x] local password hashing was hardened for the available machine memory so registration/reset no longer uses the previous oversized scrypt settings
- [x] proxy-hop configuration is now honored by Express when `TRUST_PROXY=true`
- [x] root `.env.example` documents the Resend OTP settings and proxy-hop setting

---

# 1. foundation and repository architecture

## completed

- [x] npm workspaces monorepo
- [x] TypeScript configuration
- [x] Next.js web application
- [x] Express API
- [x] shared database package
- [x] Drizzle ORM schema
- [x] pgvector schema groundwork
- [x] environment templates
- [x] root scripts for dev, AI launcher, database push, build, test, and audit
- [x] production configuration validation
- [x] CI validation workflow

## remaining

- [ ] add a reproducible production migration/release procedure instead of relying on local `db:push`
- [ ] document backup/restore procedure for the production database
- [ ] document rollback procedure for application releases
- [ ] add a production smoke-test script that checks `/health` and `/ready`
- [ ] add dependency vulnerability triage and remove/replace unnecessary moderate vulnerabilities
- [ ] pin or otherwise control critical production dependency updates

---

# 2. authentication, sessions, OTP and account security

## completed

- [x] email/password registration
- [x] email/password login
- [x] access tokens
- [x] refresh tokens
- [x] refresh rotation
- [x] logout/revocation
- [x] session listing/revocation
- [x] password reset token storage
- [x] password reset invalidates active sessions
- [x] six-digit email OTP generation
- [x] OTP expiry
- [x] OTP attempt limit
- [x] OTP single-use consumption
- [x] OTP email delivery abstraction
- [x] Resend development delivery
- [x] production configuration rejects missing critical secrets
- [x] rate limiting exists globally
- [x] request IDs and security headers exist
- [x] password hashing memory issue fixed for the current local machine

## remaining engineering

- [ ] require verified email for the exact protected actions chosen for production
- [ ] add dedicated rate limits for login, registration, OTP request, OTP verification, and password reset
- [ ] add cleanup/retention for expired OTP and password-reset records
- [ ] add login/session audit events
- [ ] add brute-force protection that escalates after repeated failures
- [ ] add production password-reset email delivery through the same provider abstraction
- [ ] add account-deletion worker rather than the current deactivation placeholder
- [ ] add privacy-safe account export covering the user's actual application data, not only user/session metadata

## user required

- [USER] production email sender/domain configuration if the development Resend sender is not sufficient
- [USER] production Resend/API credential

---

# 3. database and persistence

## completed

- [x] PostgreSQL connection
- [x] Drizzle schema
- [x] vector column support
- [x] users/sessions/auth tables
- [x] conversation/message tables
- [x] memory and embedding tables
- [x] file/upload tables
- [x] agent/task/audit/usage tables
- [x] OTP/password-reset tables
- [x] schema push confirmed working
- [x] conversation persistence API groundwork

## remaining engineering

- [ ] make workspace creation automatic and deterministic for every new account
- [ ] connect the web chat's local conversation state to server persistence without changing the UI
- [ ] restore conversations from the server after login
- [ ] synchronize create/update/delete/rename/pin operations with the backend
- [ ] handle offline/local-to-server reconciliation safely
- [ ] add database indexes based on real query paths
- [ ] add retention policies for logs, sessions, OTPs, and generated artifacts
- [ ] add backups and restore verification
- [ ] add production migration files and a migration-only deployment command

## user required

- [USER] create/configure the production Neon/PostgreSQL database and provide its production `DATABASE_URL`

---

# 4. chat engine and model routing

## completed

- [x] normal Ollama chat
- [x] streaming route
- [x] model selection support
- [x] model registry
- [x] model capability metadata
- [x] health/readiness checks
- [x] installed-model discovery
- [x] availability checks
- [x] timeout handling
- [x] capability-safe fallback routing
- [x] configured local models: Qwen 3B, Qwen 7B, Coder 1.5B, Coder latest
- [x] Alex → Qwen 3B
- [x] Ben → Coder latest
- [x] Ryan → Qwen 3B
- [x] coding-intent detection
- [x] image-generation handoff groundwork

## remaining engineering

- [ ] provider abstraction for cloud models
- [ ] provider-specific credentials/configuration abstraction
- [ ] structured output validation for agent/model responses
- [ ] retry/backoff policy per provider
- [ ] model circuit breaking after repeated provider failures
- [ ] request cancellation and timeout propagation through streaming
- [ ] usage accounting per user/model/provider
- [ ] token/context budgeting
- [ ] safe handling of oversized prompts/files
- [ ] model-response logging with privacy-safe metadata only
- [ ] optional embeddings provider
- [ ] real vision provider/model

## user required

- [USER] production inference capacity decision
- [USER] either a hosted model provider or a publicly reachable AI server; local Ollama on Bob's laptop is not a production backend for thousands of school visitors

---

# 5. memory and personalization

## completed

- [x] memory extraction groundwork
- [x] memory persistence schema
- [x] embedding/vector schema
- [x] memory-aware chat preparation groundwork
- [x] natural-language memory-write detection

## remaining engineering

- [ ] generate real embeddings
- [ ] semantic retrieval by vector similarity
- [ ] relevance ranking and recency weighting
- [ ] memory deduplication/update/expiry
- [ ] per-user memory isolation tests
- [ ] memory visibility/edit/delete controls through backend APIs
- [ ] privacy-safe memory export/delete
- [ ] prevent sensitive or accidental text from being persisted as memory without the intended policy
- [ ] integrate retrieved memories into normal and streaming chat

---

# 6. files, documents and multimodal tools

## completed

- [x] authenticated file upload
- [x] upload progress support
- [x] text extraction groundwork
- [x] PDF extraction
- [x] OCR dependency/workflow groundwork
- [x] image-generation API route
- [x] voice route groundwork

## remaining engineering

- [ ] production object storage instead of process/local filesystem assumptions
- [ ] file size/type/security validation hardening
- [ ] malware scanning strategy
- [ ] document chunking
- [ ] document indexing and retrieval
- [ ] file ownership/isolation tests
- [ ] file deletion/retention cleanup
- [ ] image generation provider integration with durable storage
- [ ] real vision model/provider
- [ ] speech-to-text and text-to-speech provider integration
- [ ] tool permission model
- [ ] tool execution audit logs

## user required

- [USER] production storage/provider choice and credentials if external object storage is used
- [USER] production multimodal provider credentials where a paid/external provider is required

---

# 7. coding agents and autonomous execution

## completed

- [x] Bob is the only user-facing conversational agent
- [x] Alex planner role
- [x] Ben coder role
- [x] Ryan reviewer role
- [x] internal agent messages
- [x] task status model
- [x] retry configuration
- [x] coding-agent bridge configuration
- [x] agent inspection endpoints
- [x] natural-language coding handoff

## remaining engineering

- [ ] replace in-memory queue with durable database/queue-backed jobs
- [ ] durable job state across API restarts
- [ ] real workspace/file execution
- [ ] command/tool sandboxing
- [ ] path traversal protection
- [ ] process/resource/time limits
- [ ] checkpointing
- [ ] rollback support
- [ ] patch/diff validation before applying changes
- [ ] structured planner/coder/reviewer output validation
- [ ] persistent agent-run history
- [ ] user cancellation
- [ ] agent permissions per workspace
- [ ] audit every file/system mutation
- [ ] end-to-end execution against a safe disposable workspace

## user required

- [USER] coding-agent bridge/workspace location and credentials if an external bridge is used
- [USER] explicit decision on how much local filesystem access BobAI is allowed to have in production

---

# 8. conversations and global application state

## completed

- [x] local conversation creation
- [x] new chat
- [x] search
- [x] select
- [x] pin
- [x] rename
- [x] delete
- [x] message pin/delete callbacks
- [x] local settings persistence
- [x] server conversation API groundwork

## remaining engineering

- [ ] server-backed conversation hydration
- [ ] server-backed message persistence
- [ ] local/server synchronization
- [ ] robust active-conversation initialization
- [ ] verified autoscroll behavior
- [ ] streaming message persistence
- [ ] cancellation state persistence
- [ ] cross-device consistency

note: these are state/data changes only; the UI remains frozen.

---

# 9. tools, automation and integrations

## completed

- [x] automation schema/route groundwork
- [x] tools schema
- [x] tool logs schema
- [x] integrations schema
- [x] webhook schema
- [x] notification schema
- [x] music route groundwork
- [x] voice route groundwork

## remaining engineering

- [ ] define a strict tool registry
- [ ] define tool input/output schemas
- [ ] per-user/per-workspace tool permissions
- [ ] execution timeouts
- [ ] retries and idempotency
- [ ] tool result size limits
- [ ] audit logging
- [ ] web search provider implementation
- [ ] research provider implementation
- [ ] notifications provider implementation
- [ ] production music/voice provider implementation where desired
- [ ] webhook signature verification and replay protection
- [ ] scheduled-job worker

---

# 10. production API reliability and security

## completed

- [x] explicit production CORS requirement
- [x] HTTPS-only production CORS validation
- [x] security response headers
- [x] HSTS in production
- [x] request IDs
- [x] JSON request size limit
- [x] global in-memory rate limiting
- [x] production env validation
- [x] proxy-hop validation and runtime support
- [x] hidden internal errors in production responses
- [x] auth middleware
- [x] admin middleware
- [x] agent authentication middleware
- [x] security integration tests

## remaining engineering

- [ ] distributed rate limiting for multiple production instances
- [ ] centralized structured logging
- [ ] error monitoring/alerting
- [ ] uptime monitoring
- [ ] database connection/pool tuning
- [ ] graceful shutdown and connection cleanup
- [ ] readiness/liveness separation
- [ ] dependency vulnerability remediation
- [ ] request timeout middleware for expensive endpoints
- [ ] upload-specific rate/size controls
- [ ] auth endpoint-specific rate limits
- [ ] abuse detection
- [ ] secret rotation procedure
- [ ] backup/restore drills
- [ ] incident-response procedure

---

# 11. web deployment and Cloudflare

## engineering that can be prepared without Bob

- [x] production web build works
- [x] environment template exists
- [x] API base URL is configurable through `NEXT_PUBLIC_API_URL`
- [ ] prepare Cloudflare-compatible deployment configuration
- [ ] verify Next.js runtime compatibility with the chosen Cloudflare deployment mode
- [ ] configure production build/output settings
- [ ] document DNS and deployment setup
- [ ] add deployment smoke tests

## user required

- [USER] Cloudflare account/project
- [USER] domain name or Cloudflare-managed hostname
- [USER] DNS access
- [USER] production frontend environment values
- [USER] final public API hostname

important: Cloudflare can host the web layer, but Ollama running on Bob's laptop is not automatically available to the public internet. Production AI inference needs a reachable backend/model host or a cloud inference provider.

---

# 12. production API hosting

## remaining engineering

- [ ] choose the actual API runtime/host compatible with Express, PostgreSQL, email delivery, file handling, and agent workers
- [ ] create production deployment config
- [ ] add health/readiness probes
- [ ] configure graceful restarts
- [ ] configure persistent logs
- [ ] configure environment variables
- [ ] configure autoscaling/instance limits where supported
- [ ] configure database connection limits
- [ ] verify streaming behavior through the production proxy

## user required

- [USER] API hosting account/project
- [USER] production environment variables/secrets
- [USER] public API hostname

---

# 13. school launch / 2k+ visitor readiness

## required before public announcement

- [ ] production AI inference capacity sized for expected concurrent users
- [ ] production database with backups
- [ ] distributed rate limiting
- [ ] abuse protection
- [ ] monitoring and alerting
- [ ] error tracking
- [ ] load test with realistic chat traffic
- [ ] load test OTP endpoints
- [ ] test simultaneous registrations
- [ ] test simultaneous streaming requests
- [ ] test database connection pressure
- [ ] test provider failure/fallback behavior
- [ ] test Cloudflare → API latency and streaming
- [ ] test large-file abuse and upload limits
- [ ] verify no local-only dependency remains in the public request path

## user required

- [USER] final expected traffic/concurrency estimate
- [USER] production hosting budget/capacity decision if free tiers cannot sustain the launch
- [USER] public domain/URL

---

# 14. testing matrix

## current

- [x] TypeScript API build
- [x] Next.js production build
- [x] security integration tests
- [x] database schema generation in CI
- [x] local Ollama model smoke tests confirmed in project chat
- [x] local OTP end-to-end confirmed in project chat

## remaining

- [ ] auth registration/login/refresh/logout automated tests
- [ ] OTP request/verify/expiry/attempt-limit automated tests
- [ ] password reset automated tests
- [ ] conversation ownership/isolation tests
- [ ] memory isolation tests
- [ ] file ownership tests
- [ ] agent authorization tests
- [ ] admin authorization tests beyond unauthenticated access
- [ ] rate-limit tests
- [ ] production config validation tests
- [ ] health/readiness tests
- [ ] streaming tests
- [ ] provider fallback tests
- [ ] image-generation failure tests
- [ ] end-to-end browser tests
- [ ] load tests
- [ ] deployment smoke tests
- [ ] backup restore test

---

# 15. things that are explicitly Bob-only / require the user's environment

These are NOT tasks to pretend-finish from the repository:

1. [USER] Cloudflare account/project and DNS/domain access.
2. [USER] production API hosting account/project.
3. [USER] production database/Neon project and `DATABASE_URL`.
4. [USER] production Resend credential and sender/domain setup if required.
5. [USER] production model/inference capacity. Ollama on a local laptop is for development, not a public 2k-person launch backend.
6. [USER] any production secrets that must never enter Git.
7. [USER] coding-agent bridge/workspace credentials and the allowed filesystem scope.
8. [USER] final public hostname(s) so CORS and frontend API configuration can be locked down.
9. [USER] final decision on free-tier vs paid capacity for the school launch.
10. [USER] final launch/load target if traffic expectations are known.

---

# 16. UI work — intentionally excluded

The following are owned by Bob and must not be changed by backend/production work unless explicitly requested:

- visual design
- layout
- spacing
- typography
- colors
- animations
- robot/scene presentation
- sidebar appearance
- topbar appearance
- composer appearance
- chat message styling
- final theme polish
- reference-accurate visual proportions

Backend/state changes may support existing UI behavior, but they must not redesign the interface.

---

# 17. production-ready definition

BobAI is considered production-ready only when all of these are true:

- [ ] production database is configured and backed up
- [ ] production email delivery is configured
- [ ] production web deployment is live
- [ ] production API deployment is live
- [ ] production model inference is publicly reachable and capacity-tested
- [ ] all critical secrets are in the hosting secret manager, never Git
- [ ] auth/OTP/password reset flows pass automated tests
- [ ] conversation persistence is server-backed
- [ ] memory retrieval is real and isolated per user
- [ ] file storage is durable and secured
- [ ] agent execution is durable, sandboxed, permissioned, and auditable
- [ ] distributed rate limiting/abuse protection is active
- [ ] monitoring and error alerting are active
- [ ] production migrations and rollback procedure are documented
- [ ] load testing passes the expected launch concurrency
- [ ] Cloudflare/proxy streaming works correctly
- [ ] deployment smoke tests pass
- [ ] UI finalization is complete by Bob

---

# 18. living update rule

This file is the source-of-truth roadmap for BobAI.

After every meaningful implementation change:

1. update the relevant `[x]`, `[~]`, `[ ]`, `[USER]`, or `[BLOCKED]` item
2. update the current head/date
3. record newly confirmed local capabilities
4. move completed engineering work out of the remaining list
5. never mark a task complete merely because code exists — it must be verified where practical
6. never mark a Bob-only environment task complete without real environment confirmation
7. never modify the UI as part of backend/production work unless explicitly requested

## immediate next engineering batch that does NOT require Bob

- [ ] automated auth/OTP/password-reset tests
- [ ] endpoint-specific auth/OTP/reset rate limits
- [ ] expired-token/OTP/reset cleanup
- [ ] production-safe password reset email through the existing provider abstraction
- [ ] server-backed conversation synchronization without UI redesign
- [ ] durable agent queue design using the existing database task schema
- [ ] structured agent output validation
- [ ] agent workspace sandbox/permission enforcement
- [ ] production migration/release tooling
- [ ] health/readiness smoke-test tooling
- [ ] distributed-production reliability preparation
- [ ] Cloudflare deployment configuration/documentation without touching UI

