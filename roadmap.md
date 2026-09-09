# BobAI — living product + engineering roadmap

**last updated:** 2026-09-09  
**base reviewed:** `main` at `6efa6103127224fd25e4b04bf3ec5c9471e13183`  
**scope:** current repository + BobAI handoffs + prior BobAI project context available in ChatGPT  
**principle:** this file records what is actually implemented, what is partially implemented, and what still needs real engineering. Discussion, UI mockups, schemas, or provider placeholders are not counted as working features.

## status legend

- [x] **done** — implemented in the repository
- [~] **implemented/foundation** — code exists but real provider/environment or broader verification is still required
- [ ] **remaining** — not complete
- [USER] **requires Bob/environment** — account, credential, domain, hardware, deployment, or explicit product choice
- [BLOCKED] cannot be honestly completed until a `[USER]` dependency exists

---

# 0. PRODUCT VISION

BobAI is intended to be a general-purpose AI platform rather than a Discord bot. The long-term product is a ChatGPT-style assistant/platform that can power the web app, future mobile/desktop clients, APIs, BobBot, and autonomous agents.

The intended assistant model is:

```text
User
  ↓
BobAI / Bob
  ↓
chat + memory + tools + files + research + creation + agents
  ↓
Alex ↔ Ben ↔ Ryan ↔ Violet/vision
```

Bob remains the user-facing manager. Internal employees should communicate with each other without making the user relay messages.

Coding agents remain a separate subsystem until their execution loop is demonstrably trustworthy.

---

# 1. WHAT IS ACTUALLY IN THE REPOSITORY NOW

## platform

- [x] npm-workspaces monorepo
- [x] `apps/api`
- [x] `apps/web`
- [x] `packages/db`
- [x] TypeScript
- [x] Node.js
- [x] Express API
- [x] Next.js/React frontend
- [x] PostgreSQL + Drizzle
- [x] pgvector schema groundwork
- [x] environment templates
- [x] development launcher
- [x] API on port 3001 in the documented local setup
- [x] web app on port 3000 in the documented local setup

## persistence/schema

- [x] users
- [x] sessions
- [x] workspaces
- [x] workspace members
- [x] conversations
- [x] messages
- [x] memories
- [x] memory embeddings schema
- [x] uploads
- [x] projects
- [x] agents
- [x] agent runs/tasks
- [x] audit logs
- [x] usage records
- [x] notifications
- [x] integrations
- [x] model-provider groundwork
- [x] workflows/automation groundwork
- [x] webhooks groundwork
- [x] billing/subscription groundwork
- [x] email OTPs
- [x] password resets
- [x] tool approvals
- [x] refresh-token family tracking

---

# 2. CORE CHAT

## implemented

- [x] normal Ollama chat
- [x] streaming chat
- [x] model selection
- [x] model registry
- [x] capability-aware routing
- [x] installed-model discovery
- [x] health/readiness checks
- [x] local Qwen models
- [x] coder-model routing
- [x] Alex/Ben/Ryan model roles
- [x] coding-intent detection
- [x] conversation creation
- [x] new chat
- [x] conversation selection
- [x] conversation restore
- [x] conversation rename
- [x] conversation deletion
- [x] conversation pinning
- [x] message controls
- [x] assistant regeneration groundwork
- [x] file attachments
- [x] local fallback when the server is unavailable
- [x] authenticated server persistence
- [x] workspace-scoped conversation persistence
- [x] complete message snapshots including attachment metadata
- [x] concurrent conversation-save protection

## recent additions

- [x] server-side cross-resource search endpoint covering conversations, messages, and projects
- [x] search query length/escaping controls
- [x] workspace authorization for search
- [x] conversation payload limits
- [x] message-shape validation before persistence
- [x] attachment payload limits
- [x] UUID validation for conversation/message identifiers

## remaining

- [ ] atomic persistence of streamed assistant messages
- [ ] explicit persisted cancelled/failed message states
- [ ] durable edit/regeneration history
- [ ] cursor pagination for large conversation histories
- [ ] better offline reconciliation
- [ ] multi-device conflict resolution
- [ ] indexed full-text search instead of ILIKE at scale
- [ ] conversation branching
- [ ] conversation merge/split
- [ ] folders/labels
- [ ] archive/restore semantics across all clients
- [ ] message version history
- [ ] long-context budget management
- [ ] automatic context compaction with verification

---

# 3. AUTHENTICATION + ACCOUNT SECURITY

## implemented

- [x] registration
- [x] login
- [x] logout
- [x] short-lived access tokens
- [x] long-lived refresh tokens
- [x] hashed token storage
- [x] refresh rotation
- [x] refresh-token family IDs
- [x] refresh-token reuse detection
- [x] family revocation on reuse
- [x] individual session revocation
- [x] all-session revocation
- [x] session metadata groundwork
- [x] password hashing with scrypt
- [x] password policy
- [x] password reset
- [x] password reset session revocation
- [x] email OTP
- [x] OTP expiry
- [x] OTP attempt limits
- [x] OTP single-use consumption
- [x] email verification
- [x] MFA/TOTP
- [x] encrypted MFA secret storage
- [x] MFA challenge protection
- [x] password change verifies current password
- [x] password change revokes sessions
- [x] generic password-reset responses to reduce enumeration
- [x] focused auth rate limits
- [x] cookie-based browser authentication
- [x] httpOnly/Secure/SameSite cookie controls
- [x] CSRF protection for cookie-authenticated mutations
- [x] permanent account-deletion foundation
- [x] account export foundation

## remaining

- [ ] passkeys/WebAuthn
- [ ] trusted-device management UI/API
- [ ] adaptive login abuse detection
- [ ] user-visible security activity timeline
- [ ] complete deletion worker for every owned data type
- [ ] prove export coverage against every user-owned table
- [ ] authentication integration test matrix
- [ ] expired OTP/reset cleanup worker
- [ ] production password-reset email verification
- [ ] final launch policy for mandatory verified email

---

# 4. PRIVACY, LEGAL + DATA CONTROL

## implemented

- [x] Privacy Policy document
- [x] Terms of Service document
- [x] Terms acceptance at registration
- [x] stored terms version/acceptance timestamp
- [x] cookie consent UI
- [x] analytics only after explicit consent
- [x] privacy-policy navigation
- [x] local browser state no longer stores full sensitive chat/session state
- [x] account deletion foundation
- [x] account export foundation
- [x] audit event sanitization/capping
- [x] provider credentials are not exposed through normal client persistence

## remaining

- [ ] complete data inventory and retention schedule
- [ ] prove deletion coverage for every storage layer
- [ ] privacy classification for memories/files/tool results
- [ ] user-visible memory controls
- [ ] data-processing/third-party provider inventory
- [ ] production legal review
- [ ] regional compliance review where BobAI is actually launched

---

# 5. MEMORY

## implemented

- [x] memory schema
- [x] memory read endpoint
- [x] memory write endpoint
- [x] memory clear endpoint
- [x] explicit “remember this” detection
- [x] user isolation
- [x] personal-workspace fallback
- [x] relevant-memory filtering
- [x] memory ON/OFF control
- [x] normal chat memory injection
- [x] explicit memory persistence from normal chat

## remaining for genuinely advanced assistant memory

- [ ] streaming memory injection parity
- [ ] real embedding generation
- [ ] pgvector similarity retrieval
- [ ] hybrid lexical + vector retrieval
- [ ] recency weighting
- [ ] importance weighting
- [ ] memory deduplication
- [ ] memory update/merge
- [ ] memory confidence
- [ ] memory provenance
- [ ] expiration/forget-after rules
- [ ] sensitive-memory policy
- [ ] privacy classification
- [ ] contradiction detection
- [ ] user approval for sensitive memories
- [ ] memory audit history
- [ ] “why does Bob remember this?” provenance
- [ ] project-specific memory isolation
- [ ] workspace-shared memory with permissions
- [ ] memory export/delete tests

---

# 6. FILES + DOCUMENT INTELLIGENCE

## implemented

- [x] authenticated file uploads
- [x] upload progress
- [x] request/file-size limits
- [x] multipart abuse limits
- [x] MIME/type validation
- [x] file signature/magic-byte validation
- [x] PDF signature validation
- [x] PDF extraction
- [x] text/markdown/CSV/HTML/CSS/JS/XML extraction
- [x] image upload recognition
- [x] temporary-file cleanup
- [x] attachment persistence groundwork
- [x] file ownership checks

## remaining

- [ ] durable object-storage abstraction
- [ ] S3/R2-compatible storage
- [ ] checksums/content-addressed files
- [ ] background extraction workers
- [ ] OCR pipeline using Tesseract
- [ ] document chunking
- [ ] stable chunk IDs
- [ ] document indexing
- [ ] semantic document retrieval
- [ ] hybrid file search
- [ ] file version history
- [ ] file sharing/permissions
- [ ] malware-scanning integration
- [ ] file retention/deletion worker
- [ ] generated-media storage
- [ ] cross-file search

---

# 7. RESEARCH + WEB KNOWLEDGE

## implemented/foundation

- [x] provider-neutral research service
- [x] authenticated research endpoint
- [x] query validation
- [x] HTTPS production-provider validation
- [x] provider timeouts
- [x] retries
- [x] response-size caps
- [x] redirect rejection where applicable
- [x] capability-aware provider gating
- [x] deep-research route/foundation

## remaining

- [ ] connect a real search provider
- [ ] stable source/result schema
- [ ] citation objects attached to answers
- [ ] source deduplication
- [ ] source ranking
- [ ] source credibility metadata
- [ ] claim-to-source mapping
- [ ] contradiction detection
- [ ] research-session persistence
- [ ] saved research collections
- [ ] research replay
- [ ] search caching
- [ ] provider failover
- [ ] web-content prompt-injection isolation
- [ ] per-user search quotas
- [ ] scheduled research briefs

[USER] real search-provider credential/capacity is required before live external search can be enabled.

---

# 8. VISION + IMAGE + MEDIA

## implemented/foundation

- [x] image-generation route
- [x] media provider abstraction
- [x] image prompt length limits
- [x] vision route
- [x] Violet vision bridge
- [x] 1–3 image input validation
- [x] PNG/JPEG/WebP validation
- [x] image-size limits
- [x] PNG color parsing safety
- [x] model-only processing for formats that cannot be safely parsed locally
- [x] response truncation
- [x] provider fail-closed behavior
- [x] video-generation contract groundwork
- [x] voice provider abstraction
- [x] music provider abstraction/route groundwork

## remaining

- [ ] connect vision into normal chat attachments
- [ ] automatic vision-capability detection
- [ ] image understanding/OCR/layout extraction
- [ ] persistent media asset library
- [ ] image editing
- [ ] image upscaling
- [ ] video generation jobs
- [ ] video editing jobs
- [ ] video scene/chapter extraction
- [ ] audio transcription
- [ ] speaker labels
- [ ] audio summaries
- [ ] voice synthesis
- [ ] music generation
- [ ] unified media history
- [ ] media retention cleanup
- [ ] media safety/policy layer

[USER] real external media providers or an adequately capable local model are required for live production media generation.

---

# 9. PERSONALIZATION + SETTINGS

## implemented

- [x] settings API groundwork
- [x] server-side settings persistence
- [x] personality configuration groundwork
- [x] model preferences groundwork
- [x] memory preference
- [x] four-theme system: dark/light/futuristic/anime
- [x] theme persistence
- [x] legacy browser-state cleanup for sensitive onboarding data
- [x] saved prompt API groundwork
- [x] prompt-library route

## remaining

- [ ] complete user preference schema
- [ ] response-length preference
- [ ] tone/style controls
- [ ] language preference
- [ ] default-model preference
- [ ] default-tool permissions
- [ ] custom instructions
- [ ] prompt variables/templates UI
- [ ] personality presets
- [ ] import/export preferences
- [ ] per-project settings
- [ ] accessibility preferences

---

# 10. PROJECTS + WORKSPACES

## implemented

- [x] workspace schema
- [x] workspace members
- [x] personal-workspace fallback
- [x] workspace authorization
- [x] projects schema/API foundation
- [x] project-aware search
- [x] project ownership checks

## remaining

- [ ] project-specific memory
- [ ] project file collections
- [ ] project instructions
- [ ] project-specific model/tool permissions
- [ ] project context window
- [ ] project activity history
- [ ] workspace roles/permissions beyond membership
- [ ] invitations
- [ ] collaboration
- [ ] shared conversations
- [ ] project export/import

---

# 11. BOB + EMPLOYEE AGENTS

## implemented

- [x] Bob as intended user-facing manager
- [x] Alex planner/engineering manager role
- [x] Ben coding role
- [x] Ryan review/security role
- [x] Violet vision bridge
- [x] model-role mapping
- [x] coding-intent detection
- [x] agent task routes
- [x] workspace authorization before agent task creation
- [x] workspace/user-scoped task retrieval
- [x] durable task persistence
- [x] startup recovery groundwork
- [x] queue concurrency controls
- [x] attempt/retry limits
- [x] duplicate retry protection
- [x] mutation audit trail
- [x] production sandbox-attestation gate for coding-agent access

## remaining

- [ ] finish reliable Alex → Ben → executor → Ryan → validation loop
- [ ] prevent zero-action jobs from being marked successful
- [ ] robust structured planner output validation
- [ ] robust coder action generation
- [ ] reliable reviewer diff-awareness
- [ ] genuine agent-to-agent communication
- [ ] internal agent handoff artifacts
- [ ] visible Bob delegation state
- [ ] task dependency graph
- [ ] agent budget/token accounting
- [ ] confidence/escalation thresholds
- [ ] human approval checkpoints
- [ ] real disposable coding workspace
- [ ] process isolation
- [ ] CPU/memory/time limits
- [ ] command policy
- [ ] checkpoint/rollback verification
- [ ] patch/diff validation
- [ ] persistent agent-run history
- [ ] cancellation propagation
- [ ] end-to-end sandbox tests
- [ ] remove every remaining demo/default coding task

[USER] a real local/remote coding-agent runtime with sufficient hardware and verified isolation is required before production autonomous code execution.

---

# 12. TOOLS + MCP + ACTIONS

## implemented/foundation

- [x] tool schema groundwork
- [x] tool registry/capability groundwork
- [x] tool approvals
- [x] hashed approval tokens
- [x] atomic approval consumption
- [x] tool audit groundwork
- [x] MCP route/foundation
- [x] integration schema
- [x] webhook schema
- [x] automation schema/route
- [x] capability flags for optional automation/diagram/sketch-to-UI features
- [x] unknown provider-backed tools fail closed

## remaining

- [ ] strict tool registry
- [ ] per-tool JSON schemas
- [ ] per-tool permissions
- [ ] tool result-size limits everywhere
- [ ] universal idempotency keys
- [ ] retry policy per tool
- [ ] timeout policy per tool
- [ ] user confirmation for destructive actions
- [ ] signed webhook verification
- [ ] webhook replay protection
- [ ] webhook delivery retries
- [ ] scheduled automation worker
- [ ] user-visible automation history
- [ ] user-managed MCP server registry
- [ ] per-MCP-server permission scopes
- [ ] OAuth-based connector authorization

---

# 13. SEARCH, NOTIFICATIONS + PRODUCTIVITY

## implemented

- [x] authenticated server-side search
- [x] conversation/message/project search
- [x] notification persistence schema
- [x] authenticated notification inbox
- [x] mark-one-read
- [x] mark-all-read
- [x] archive notification
- [x] notification ownership checks
- [x] reminder route/foundation

## remaining

- [ ] frontend notification center integration
- [ ] unread-count endpoint/streaming updates
- [ ] push notifications
- [ ] email notifications
- [ ] reminder scheduler
- [ ] recurring reminders
- [ ] timezone-aware scheduling
- [ ] calendar integration
- [ ] task lists
- [ ] lightweight notes
- [ ] saved research
- [ ] saved artifacts

---

# 14. PUBLIC WEBSITE

## confirmed/implemented from prior project work

- [x] navigation
- [x] 404 page
- [x] breadcrumbs
- [x] CTA sections
- [x] FAQ
- [x] About
- [x] Contact UI
- [x] Privacy page
- [x] Terms page
- [x] waitlist UI
- [x] cookie/analytics consent
- [x] sitemap
- [x] robots
- [x] Open Graph metadata
- [x] favicon
- [x] responsive navigation

## remaining

- [ ] final public-copy review
- [ ] production analytics only after consent
- [ ] production domain configuration
- [ ] performance budget
- [ ] accessibility audit
- [ ] SEO validation

---

# 15. FRONTEND / NEURAL UI HISTORY

The handoff confirms the following work exists or was built during the earlier UI project:

- [x] original functional chat architecture
- [x] neural UI component system
- [x] `NeuralShell`
- [x] `NeuralSidebar`
- [x] `NeuralTopbar`
- [x] `NeuralComposer`
- [x] `NeuralChatStage`
- [x] `NeuralScene`
- [x] `SceneEngine`
- [x] `RobotIntro`
- [x] `ThemeProvider`
- [x] futuristic/glass visual direction
- [x] Three.js robot scene groundwork
- [x] robot GLTF assets
- [x] charging-station scene concept
- [x] anime intro concept
- [x] four theme identifiers
- [x] sidebar conversation-management controls
- [x] autoscroll work/history
- [x] provider-context runtime fixes

## current rule

The neural UI must not become a second independent chat state system. Existing chat state/backend capabilities should be reused and unified.

## remaining

- [ ] finish one canonical frontend state architecture
- [ ] ensure every visible control calls a real backend/state action
- [ ] final robot asset/path verification
- [ ] final robot intro/shutdown behavior
- [ ] complete anime 3D system if retained
- [ ] complete theme-specific visuals
- [ ] final responsive/mobile behavior
- [ ] accessibility/keyboard navigation
- [ ] visual regression testing

**UI is not being randomly redesigned during backend hardening.** Visual work should happen only when explicitly requested or when required to make an existing control functional.

---

# 16. DATABASE + MIGRATIONS

## implemented

- [x] PostgreSQL integration
- [x] Drizzle schema
- [x] pgvector schema support
- [x] migration locking/checksums
- [x] migration bookkeeping
- [x] personal-workspace concurrency protection
- [x] refresh-token-family migration

## remaining

- [ ] complete migration coverage for every historical schema change
- [ ] remove reliance on production `db:push`
- [ ] deterministic migration deployment
- [ ] deterministic rollback procedure
- [ ] backup verification
- [ ] restore drill
- [ ] connection-pool tuning
- [ ] query performance indexes
- [ ] database observability
- [ ] retention jobs
- [ ] carefully designed PostgreSQL RLS rollout

**RLS warning:** do not blindly enable RLS. It must be designed around the existing application authorization model and tested against every workspace/user query.

[USER] production Neon/PostgreSQL instance and credentials are required for production verification.

---

# 17. SECURITY FINAL-PASS STATUS

## implemented

- [x] MFA
- [x] account-enumeration-resistant reset behavior
- [x] business-logic authorization checks
- [x] workspace ownership checks
- [x] race-safe personal workspace creation
- [x] refresh-token rotation/reuse detection
- [x] CSRF protection
- [x] secure browser cookies
- [x] sensitive browser storage reduction
- [x] open-redirect/provider URL validation
- [x] provider redirect rejection where applicable
- [x] unsecured endpoint review for protected API routes
- [x] request timeouts
- [x] response-size limits
- [x] upload/multipart limits
- [x] file signature validation
- [x] AI output/result validation foundations
- [x] excessive AI-permission fail-closed behavior
- [x] production environment validation
- [x] pinned GitHub Actions
- [x] CI credential persistence disabled
- [x] security headers
- [x] HSTS in production
- [x] CORS restrictions
- [x] rate limiting
- [x] audit logging
- [x] coding-agent sandbox attestation gate
- [x] destructive coding-operation approval groundwork
- [x] audit metadata sanitization

## remaining

- [ ] distributed rate limiting
- [ ] centralized security monitoring
- [ ] dependency vulnerability monitoring
- [ ] secret rotation automation
- [ ] supply-chain/license policy
- [ ] production penetration test
- [ ] production load test
- [ ] incident-response runbook
- [ ] full webhook security once inbound webhooks are enabled
- [ ] full coding sandbox verification

---

# 18. RELIABILITY + OBSERVABILITY

## implemented

- [x] API request timeout
- [x] Node headers timeout
- [x] keep-alive timeout
- [x] graceful shutdown logic
- [x] health endpoint
- [x] readiness endpoint with database dependency check
- [x] request IDs
- [x] sanitized production errors
- [x] task retry limits
- [x] task recovery groundwork

## remaining

- [ ] structured logs
- [ ] centralized log storage
- [ ] error tracking
- [ ] metrics
- [ ] latency dashboards
- [ ] model/provider health dashboard
- [ ] alerting
- [ ] uptime monitor
- [ ] queue-depth metrics
- [ ] token/usage dashboards
- [ ] database slow-query monitoring
- [ ] distributed tracing

---

# 19. CI/CD + SUPPLY CHAIN

## implemented

- [x] CI workflow
- [x] API/web build commands
- [x] security tests
- [x] npm audit command
- [x] GitHub Actions pinned by SHA
- [x] `persist-credentials: false`
- [x] dependency-lock synchronization workflow
- [x] lockfile regeneration automation
- [x] CI revalidation after dependency-lock synchronization
- [x] CodeQL workflow
- [x] Lighthouse workflow
- [x] workflow concurrency/timeouts

## current verification

- [~] latest CI/Lighthouse/CodeQL runs were queued/pending at the time of this roadmap update; they must report success before the repository is called green

## remaining

- [ ] required-status branch protection
- [ ] release tagging
- [ ] signed releases/commits if desired
- [ ] SBOM generation
- [ ] dependency/license policy
- [ ] automated dependency-update review
- [ ] production deployment pipeline
- [ ] rollback deployment pipeline

---

# 20. PRODUCTION DEPLOYMENT

## code-side preparation

- [x] production environment validation
- [x] explicit production CORS requirements
- [x] HTTPS requirements
- [x] health/readiness endpoints
- [x] production provider fail-closed behavior
- [x] production coding sandbox gate

## user/environment required

- [USER] production Neon/PostgreSQL
- [USER] production AI inference provider or hosted model capacity
- [USER] production search provider
- [USER] production object storage if durable files are required
- [USER] production email sender/domain
- [USER] hosting account
- [USER] domain/DNS
- [USER] public frontend hostname
- [USER] public API hostname
- [USER] production secrets
- [USER] real coding-agent runtime if autonomous coding is enabled

---

# 21. SCHOOL / HIGH-CONCURRENCY READINESS

The school/science-fair target discussed in the project is a real multi-user deployment, not merely a laptop demo.

## remaining engineering

- [ ] production load test
- [ ] concurrent chat tests
- [ ] queue saturation tests
- [ ] provider rate-limit handling
- [ ] distributed rate limiting
- [ ] database connection limits
- [ ] object-storage throughput tests
- [ ] CDN/static asset strategy
- [ ] cache strategy
- [ ] autoscaling strategy
- [ ] graceful degradation when AI providers fail
- [ ] friendly maintenance mode
- [ ] abuse monitoring

[USER] actual hosting/inference/database capacity is required to validate this section.

---

# 22. HIGH-VALUE AI CAPABILITIES TO COMPLETE

These are the capabilities that modern AI users commonly expect and that fit BobAI's architecture. They are **implementation targets**, not counted as done merely because a route/schema exists.

## intelligence

- [ ] strong hosted/cloud model support
- [ ] multi-model comparison
- [ ] automatic model selection by task
- [ ] context-aware model selection
- [ ] user-selectable reasoning depth where supported
- [ ] response citations
- [ ] factuality/source verification layer
- [ ] structured-output repair
- [ ] tool-use planning

## memory

- [ ] semantic memory
- [ ] editable memories
- [ ] memory provenance
- [ ] memory expiration
- [ ] project memory
- [ ] memory conflict resolution

## research

- [ ] live web search
- [ ] deep research
- [ ] multi-source synthesis
- [ ] citations
- [ ] source comparison
- [ ] saved research
- [ ] scheduled briefs

## creation

- [ ] image generation/editing
- [ ] document generation
- [ ] spreadsheets/data analysis
- [ ] presentations
- [ ] diagrams
- [ ] canvas/artifacts
- [ ] code generation
- [ ] code execution in sandbox
- [ ] multimodal analysis
- [ ] voice conversation
- [ ] video understanding/generation
- [ ] music/audio generation

## agents

- [ ] autonomous multi-step tasks
- [ ] Bob delegation
- [ ] Alex planning
- [ ] Ben implementation
- [ ] Ryan verification
- [ ] Violet visual verification
- [ ] approvals
- [ ] resumable jobs
- [ ] task history
- [ ] user-visible progress

## productivity

- [ ] reminders
- [ ] scheduled tasks
- [ ] calendar
- [ ] email/notification actions
- [ ] GitHub integration
- [ ] MCP connectors
- [ ] user-approved external actions
- [ ] reusable workflows

## platform

- [ ] mobile client
- [ ] desktop client
- [ ] public API
- [ ] API keys/scopes
- [ ] SDKs
- [ ] collaboration
- [ ] shared projects
- [ ] usage/billing
- [ ] admin console

---

# 23. WHAT SHOULD NOT BE FAKED

BobAI must never advertise a capability as working merely because:

- a database table exists
- a route exists
- a UI button exists
- a provider URL is configurable
- a model name is configured
- an agent returned text
- a reviewer said “approved”
- a task executed zero actions

A capability is **done** only when its real execution path, authorization, failure behavior, persistence, and tests are present.

Provider-backed capabilities stay disabled until a real provider and credential are configured.

---

# 24. CURRENT PRIORITY ORDER

1. **Make CI genuinely green and keep it green.**
2. **Finish server-backed chat semantics and large-history performance.**
3. **Finish advanced memory with pgvector.**
4. **Finish file indexing/RAG.**
5. **Connect a real research provider and citations.**
6. **Finish Bob → Alex/Ben/Ryan/Violet orchestration and trustworthy coding execution.**
7. **Finish notifications/reminders/automation.**
8. **Finish real multimodal providers.**
9. **Finish production observability, load testing, backups, and deployment.**
10. **Then expand external connectors, mobile/desktop clients, collaboration, and the public API.**

The product should grow by connecting these systems into **one BobAI experience**, not by creating parallel duplicate architectures.

---

# 25. HANDOFF / PROJECT-CONTEXT RECONCILIATION

The older handoffs correctly documented several historical gaps: neural UI integration, duplicate chat architecture, incomplete coding-agent reliability, missing production providers, and uncertain final frontend state. Later repository work has closed many of the security, persistence, routing, provider-gating, and authentication gaps.

Historical statements such as “localStorage conversations are the primary persistence layer,” “notifications are only schema groundwork,” “conversation routes are unmounted,” or “MFA is missing” must therefore be treated as **historical**, not current, when the repository now contains the corresponding implementation.

The handoff also explicitly warned against counting discussion as implementation. That rule remains authoritative.

---

# 26. DEFINITION OF “BOBAI IS ACTUALLY FINISHED”

BobAI is not finished when it has a pretty chat page.

The finish line is:

```text
secure account
  ↓
persistent conversations
  ↓
strong model routing
  ↓
useful memory
  ↓
files + RAG
  ↓
web research + citations
  ↓
multimodal understanding/creation
  ↓
reliable tools
  ↓
Bob orchestration
  ↓
verified employee agents
  ↓
productivity + automations
  ↓
privacy + export + deletion
  ↓
observability + backups
  ↓
load-tested production deployment
```

Every stage needs a real implementation and verification path. No “looks finished” shortcuts.
