# BobAI handoff — 2026-09-11

## Purpose

This is the canonical handoff for the next BobAI chat. It records the repository state, verified work from the current project conversation, the roadmap status, environment-dependent work, known caveats, and the commit history that matters to the next session.

**Repository:** `BobPlayz/BobAi`  
**Branch:** `main`  
**Last user-confirmed clean/build commit:** `d415bcdd6edf37d45df865af3c74ffdb3975365f` (`d415bcd`)  
**Current repo after this handoff document:** includes the additional handoff/audit changes made during this session.  
**Local build last explicitly confirmed by user:** `npm run build` passed API TypeScript + Next.js production build, 18/18 static pages.

---

# 1. Product architecture

BobAI is the general AI platform, not BobBot itself.

```text
User
  ↓
BobAI / Bob
  ↓
chat + memory + tools + files + research + media + agents
  ↓
Alex ↔ Ben ↔ Ryan ↔ Violet/vision
```

- Bob = user-facing manager.
- Alex = planning/research/engineering manager.
- Ben = coding/implementation.
- Ryan = review/security.
- Violet = vision/visual bridge.
- Coding agents remain a separate subsystem until their runtime is genuinely isolated and verified.

Core stack: Next.js/React web, Express/TypeScript API, PostgreSQL/Drizzle, pgvector groundwork, provider-neutral model gateway, npm workspaces monorepo.

---

# 2. Important project rule

Do **not** call a schema, route, placeholder, abstraction, or provider interface "done" merely because code exists. A capability is fully complete only when its application path works, authorization is correct, failures are handled, and the required external environment is available where applicable.

Do not claim BobAI is impossible to hack, production-ready, or legally risk-free. Production security still needs real environment testing and external review.

---

# 3. What was completed in the current project conversation

## Build recovery

The API initially had five TypeScript errors. They were fixed through these commits:

- `c120278` — removed unsupported Multer `fieldArrayIndexLimit` option.
- `1e2bd83` — removed stale Ollama readiness dependency.
- `bd3b1f7` — corrected streaming route memory-record typing.
- `eca5bee` — resolved remaining API TypeScript errors, including model capability narrowing and session family typing.
- `d415bcd` — narrowed refresh session family UUID type.

After `d415bcd`, the user ran:

```text
npm run build
```

and it completed successfully:

- API TypeScript: passed
- Next.js production build: passed
- static page generation: 18/18
- no build errors

This is the last directly verified local build in the conversation. Any commits made after that must be rebuilt locally before being called green.

## Code-side hardening/implementation made before the build fixes

The final-pass work in this conversation also implemented/fixed:

- streamed assistant-message persistence lifecycle: pending → streaming → completed/failed/cancelled
- conversation persistence without deleting/recreating the entire message history
- conversation ownership checks
- transaction/advisory-lock protection for concurrent conversation saves
- conversation pagination groundwork
- deterministic conversation cursors
- semantic-memory retrieval path
- embedding provider abstraction
- memory deduplication foundation
- sensitive-memory rejection for obvious secrets
- memory update/delete/clear foundations
- preference validation/persistence for personality, model, memory, theme, language, response style/length, tone, default model/tool permissions, custom instructions, prompt templates, notifications, voice, privacy, training, accessibility
- pgvector/message retrieval indexes
- stale Ollama model-agent dependency removal
- coding orchestration routed through the model gateway instead of the removed Ollama provider
- provider-neutral vision HTTP contract with URL, timeout, payload, response, and image-size validation
- updated embedding environment configuration

## Handoff/security documentation

- `docs/FINAL-BACKEND-AUDIT.md` records the previous backend audit and explicitly separates repository-completed work from environment-dependent verification.
- `roadmap.md` is the living product/engineering roadmap and must be treated as the source of truth for what counts as actually implemented.
- This file is the new chat handoff.

---

# 4. Roadmap status: fully implemented

These are repository-level capabilities that the roadmap already records as implemented and that were part of the audited codebase.

## Platform

- npm workspaces monorepo
- API/web/packages DB structure
- TypeScript/Node/Express/Next.js
- PostgreSQL + Drizzle
- pgvector schema groundwork
- environment templates
- development launcher
- documented local ports

## Persistence/security foundation

- users, sessions, workspaces, workspace members
- conversations/messages/memories
- uploads/projects/agents/agent runs/tasks
- audit logs/usage/notifications/integrations
- provider/model groundwork
- workflow/webhook/billing groundwork
- OTP/password-reset records
- tool approvals
- refresh-token family tracking

## Authentication/account security

- registration/login/logout
- short-lived access tokens
- refresh tokens with hashed storage
- refresh rotation/reuse detection
- family/session revocation
- password hashing/policy/reset/change
- email OTP + verification
- MFA/TOTP + encrypted secret storage
- MFA challenge protection
- generic reset behavior
- focused auth rate limits
- secure browser cookies
- CSRF protection
- account deletion/export foundations

## Privacy/legal foundation

- Privacy Policy
- Terms of Service
- terms acceptance/version/timestamp
- cookie consent
- consent-gated analytics
- sensitive browser-state reduction
- audit-event sanitization
- provider credential protection

## Memory foundation

- memory schema/read/write/clear
- explicit remember detection
- user/workspace isolation
- memory enable/disable
- normal chat memory injection
- explicit memory persistence
- semantic retrieval code path
- embedding-provider abstraction
- sensitive-memory filtering

## Files foundation

- authenticated uploads
- upload progress
- file/multipart limits
- MIME and magic-byte validation
- PDF/text extraction foundation
- image signature checks
- temporary-file cleanup
- attachment persistence groundwork
- file ownership checks

## Research foundation

- provider-neutral research service
- authenticated research endpoint
- validation, timeout, retry and response-size controls
- HTTPS production-provider validation
- provider capability gating
- deep-research route/foundation

## Vision/media foundation

- image generation route/provider abstraction
- vision route/Violet bridge
- image input validation
- PNG/JPEG/WebP validation
- image-size limits
- response truncation
- provider fail-closed behavior
- video/voice/music contract groundwork

## Projects/workspaces foundation

- workspace schema/members
- personal-workspace fallback
- workspace authorization
- projects API/schema
- project-aware search
- ownership checks

## Agents foundation

- Bob/Alex/Ben/Ryan/Violet role mapping
- coding-intent detection
- agent task routes
- workspace authorization
- durable task persistence
- startup recovery groundwork
- concurrency controls
- attempt/retry limits
- duplicate retry protection
- mutation audit trail
- production coding sandbox-attestation gate

## Tools/MCP foundation

- tool schema/registry groundwork
- approvals + hashed approval tokens
- atomic approval consumption
- tool audit groundwork
- MCP route/foundation
- integrations/webhooks/automation schemas
- capability flags
- unknown provider-backed tools fail closed

## Search/notifications

- authenticated server-side search
- conversation/message/project search
- notification persistence/inbox
- read/mark-all/archive operations
- ownership checks
- reminder route/foundation

## Public website/UI foundation

- navigation, 404, breadcrumbs, CTA sections
- FAQ/About/Contact
- Privacy/Terms/waitlist
- cookie/analytics consent
- sitemap/robots/OG metadata/favicon
- responsive navigation
- neural UI architecture and major components
- theme system and visual groundwork
- Three.js robot scene groundwork

## Database/CI/security foundation

- PostgreSQL/Drizzle integration
- migration bookkeeping/locking/checksums
- personal-workspace concurrency protection
- request IDs/timeouts/graceful shutdown
- health/readiness
- sanitized production errors
- rate limiting foundation
- audit logging
- security headers/HSTS/CORS
- pinned GitHub Actions
- CI credential persistence disabled
- CodeQL/Lighthouse workflows
- dependency-lock synchronization
- training-policy/dataset validation workflow

---

# 5. Roadmap: implemented/foundation but NOT fully complete

These have code foundations but cannot honestly be called complete yet.

## Core chat

- streaming persistence needs fresh post-change build/integration verification
- long-context management/compaction still needs real implementation
- offline reconciliation/multi-device conflict resolution are incomplete
- full-text search at scale is not finished
- branching/merge/split/folders/message versioning are not fully finished

## Memory

- real production embedding provider still needs credentials/configuration
- hybrid lexical + vector retrieval is not finished
- recency/importance ranking is not fully implemented
- conflict detection/provenance/audit history/expiration are incomplete
- project/shared memory permissions are incomplete

## Files

- local disk uploads are not durable production object storage
- background extraction/OCR/chunking/indexing/search are incomplete
- malware scanning is not integrated
- file sharing/versioning/retention are incomplete

## Research

- research provider abstraction exists, but live search is not enabled without a real provider
- citation/source objects, claim mapping, source ranking/deduplication, research persistence/replay and caching remain incomplete
- web prompt-injection isolation remains incomplete

## Media/vision

- vision is a provider route/bridge, not yet fully integrated into normal chat attachments
- persistent media library/history and media retention are incomplete
- OCR/layout understanding/audio transcription/speaker labels/TTS/music/video jobs remain incomplete

## Personalization

- the API now has broad preference validation/persistence groundwork, but UI integration and complete end-to-end behavior still need verification
- personality presets/import/export/per-project settings/accessibility integration remain incomplete

## Projects

- project-specific memory/files/instructions/model/tool permissions/context/activity are incomplete
- workspace roles/invitations/collaboration/shared conversations/export-import remain incomplete

## Agents

- durable tasks and safety gates exist
- the genuine Alex → Ben → executor → Ryan validation loop is not yet proven end-to-end
- structured planner/coder/reviewer output validation remains incomplete
- genuine internal handoff artifacts/agent communication remain incomplete
- budgets/dependencies/approval checkpoints/escalation remain incomplete
- a real disposable coding sandbox with process isolation and resource limits remains incomplete

## Tools/MCP

- schemas/registry/approval foundation exists
- universal per-tool schemas/permissions/idempotency/retry/timeout policies are incomplete
- destructive-action confirmation needs complete coverage
- signed webhook/replay protection/delivery retries remain incomplete
- scheduled automation worker/history remains incomplete
- MCP user registry/scopes/OAuth remains incomplete

---

# 6. Roadmap: code-side work still required

The next chat should continue implementation, not just write another checklist.

### Highest priority

1. **Finish and verify conversation persistence/pagination**
   - deterministic cursor behavior
   - message pagination
   - long-context budgeting/compaction
   - version/branch semantics where required

2. **Finish production-grade memory**
   - real embedding provider wiring
   - hybrid vector + lexical retrieval
   - recency/importance scoring
   - dedup/update/merge/conflict/provenance
   - memory audit history
   - project/workspace permission boundaries

3. **Finish document intelligence**
   - durable storage abstraction
   - background extraction
   - OCR
   - chunking/stable IDs
   - document indexing/search/retrieval
   - retention/deletion

4. **Finish research pipeline**
   - provider adapter
   - normalized source schema
   - citations
   - source ranking/deduplication
   - claim/source mapping
   - prompt-injection isolation for untrusted web content
   - persistence/cache/quotas

5. **Finish normal-chat vision integration**
   - attachment-to-vision routing
   - automatic capability detection
   - OCR/layout path
   - unified media records/history

6. **Finish project context**
   - project memory
   - project files
   - project instructions
   - project model/tool permissions
   - context-window assembly

7. **Finish agent orchestration**
   - structured output schemas
   - Alex → Ben → executor → Ryan loop
   - real handoff artifacts
   - dependency graph
   - budgets
   - approval checkpoints
   - cancellation propagation
   - diff/patch validation

8. **Finish sandbox execution**
   - disposable workspace
   - isolation
   - CPU/memory/time limits
   - command allow/deny policy
   - checkpoint/rollback verification
   - end-to-end sandbox tests

9. **Finish tool/action security**
   - strict schemas
   - permission enforcement
   - result limits
   - idempotency
   - per-tool retry/timeout policy
   - destructive confirmation

10. **Finish webhooks/automation/MCP**
    - signed inbound webhooks
    - replay protection
    - delivery retry/history
    - scheduled worker/history
    - MCP server registry/scopes/OAuth

11. **Finish reliability/observability**
    - structured logs
    - centralized logging
    - metrics
    - tracing
    - error tracking
    - alerts
    - queue/provider/database dashboards

12. **Finish database deployment discipline**
    - migration coverage
    - remove production `db:push` dependence
    - deterministic deploy/rollback
    - backup/restore verification
    - connection-pool tuning
    - performance indexes
    - carefully tested RLS rollout if chosen

---

# 7. Security holes / risks that remain

These are not claims of an active exploit. They are remaining engineering/security gaps identified by the roadmap/audit state.

- Distributed rate limiting is not complete.
- Real production security monitoring is not complete.
- Dependency vulnerability/license/supply-chain policy is incomplete.
- Secret rotation automation is incomplete.
- Full webhook security is incomplete until inbound webhooks are enabled.
- Autonomous coding is not safe to enable merely because the attestation gate exists. Real isolation/resource limits/runtime verification are required.
- Local upload storage is not appropriate as the final production storage layer.
- Web research content must be treated as untrusted input and isolated from privileged tool/system instructions.
- Tool permissions must be enforced per tool, not only at broad capability level.
- MCP OAuth/scopes are not complete.
- Database authorization is application-enforced; an RLS rollout must be deliberately designed/tested rather than blindly enabled.
- Account deletion/export coverage must be proven across every user-owned storage type.
- Production penetration/load testing has not been performed.
- Observability/incident-response coverage is incomplete.

---

# 8. User/environment/laptop required

These cannot be genuinely completed by repository code alone.

## Bob/environment

- real Neon/PostgreSQL production/test instance and credentials
- production AI inference provider or sufficient local model hardware
- real search-provider credential/capacity
- durable object storage such as S3/R2-compatible storage
- production email sender/domain
- hosting account
- production frontend/API domains and DNS
- production secrets
- real coding-agent runtime if autonomous coding is enabled
- verified sandbox runtime/hardware

## Laptop/local verification

The user's laptop is needed for:

- running `npm run build` after any new repo commits
- running local API/web smoke tests
- testing local environment variables/provider connectivity
- testing local model inference if used
- testing the actual Bob Coding Agents installation if present
- verifying browser behavior of the real UI
- testing local uploads/vision/media against actual providers

The last user-confirmed local build was green at `d415bcd`. Any commits after that need another local build before being called verified.

---

# 9. Training status

Bob-0.1 training infrastructure was added earlier and merged.

Training components include:

- Qwen/Qwen2.5-0.5B-Instruct base configuration
- LoRA/SFT training scripts
- synthetic starter dataset
- dataset sanitization/deduplication/splitting
- fixed evaluation prompts
- evaluation/smoke evaluator
- model registry metadata
- training CI/policy tests
- model artifacts ignored from source control

**Important:** no trained model weights should be assumed to exist. A successful training script would still be experimental and would not make BobAI production-quality.

Training is intentionally decoupled from application architecture. A future internally trained Bob model should plug into the existing model gateway rather than forcing rewrites of memory/tools/agents/UI.

---

# 10. Commit ledger

The repository was compared from `03a00ed` through `d415bcd`; GitHub reports **45 commits ahead** in that range. The following ledger records the commits explicitly surfaced/verified during the project conversation and the final-pass work. Earlier commits in the 45-commit range are preserved in Git history and should be inspected with `git log` if exact per-commit reconstruction is needed.

### Model/provider architecture

- `03a00ed` — `refactor(ai): finalize provider-neutral chat engine`
- `3858c8a` — `refactor(chat): migrate streaming route to Bob model gateway`
- `fec4cca3` — `feat(ai): support multiple first-party coding model names`
- `8aaa25f` — `fix(ai): correct first-party model configuration lookup`
- `3283b675` — `fix(ai): honor selected Bob and coding model identities`
- `1ba949d1` — `refactor(ai): remove obsolete Ollama provider`

### Training/privacy

- `bc2420ce` — `feat(ai): add consent-gated training data policy`
- `8c6f40fd` — `docs(privacy): document explicit model-training consent rules`
- `982d6dfc` — `docs(ai): define Bob model training and personalization architecture`
- `13620b1` — merged Bob-0.1 training PR into `main`
- `57b39a77` — `fix(privacy): make training eligibility fail closed`

### Privacy/upload/security hardening surfaced in the repository history

- `2408763` — `security(deps): align root multer requirement with patched release`
- `25405fd` — `security(upload): harden multipart limits and verify image signatures`
- `0066a6f` — `privacy(web): stop persisting chat content in localStorage`
- `4570f61` — `privacy(web): clear legacy conversation cache containing message content`

### Final-pass/core reliability sequence

- `b68d543` — `feat(memory): use semantic retrieval for chat memory`
- `b181d0f` — `feat(db): add vector and message retrieval indexes`
- `c4f237b` — `docs(config): document embedding provider settings`
- `1f9f5e4` — `balls` (repository history marker; no functional claim should be inferred from the commit name alone)
- `3524975` — search-route syntax fix that followed the broken `search.ts` build
- `c120278` — `fix(upload): remove unsupported multer limit option`
- `1e2bd83` — `fix(health): remove stale Ollama readiness dependency`
- `bd3b1f7` — `fix(stream): accept persisted memory records`
- `eca5bee` — `fix(build): resolve remaining API TypeScript errors`
- `d415bcd` — `fix(auth): narrow refresh session family UUID type`

### Current handoff-session commits after the last user-confirmed build

These were made directly while creating/continuing the handoff/audit work and therefore **must be rebuilt locally before being considered verified**:

- `81b04a07b96aada115cad683f0daf2940af1d4b6` — `feat(memory): use semantic retrieval in streaming chat` / conversation-stream changes made during this session
- `8a1960c31e3d4638ace8b06aed607fbb5d73c16f` — `refactor(vision): remove stale Ollama dependency`
- additional handoff/audit documentation commits may follow this document update.

**Do not treat the two post-build code commits above as locally verified until the laptop build is run again.**

---

# 11. Known verification state

At the point of the last user-provided terminal output:

```text
branch: main
working tree: clean
up to date with origin/main
npm run build: PASS
```

That build passed after `d415bcd`.

The current handoff session subsequently changed repository code, so the next chat should first synchronize the laptop and run the build again before claiming green.

Do not infer GitHub Actions are green without checking the actual latest workflow runs.

---

# 12. Recommended next-chat opening

Start by reading this file and `roadmap.md`. Then:

1. inspect the current `main` tree at the latest commit
2. compare against this handoff
3. rebuild locally after syncing
4. fix any regressions introduced after `d415bcd`
5. continue the **code-side remaining items**, prioritizing storage/document intelligence, research/citations/prompt-injection isolation, project context, agent orchestration/sandboxing, tool/MCP/webhook/automation security, and observability
6. only mark an item `[x]` when the end-to-end repository implementation is real and verified
7. leave `[USER]` items explicitly blocked until the required environment exists

The user specifically does **not** want repeated theoretical checklists when implementation is possible. Inspect the actual repository and make the code changes.

---

# 13. Do not lose these project decisions

- BobAI is not BobBot.
- Bob is the only user-facing manager; internal agents should hand off internally.
- Ollama is no longer a required architecture dependency.
- Model serving is provider-neutral and should go through the model gateway.
- Training must be consent-gated and privacy-sanitized.
- Do not commit trained model artifacts.
- Do not expose sensitive user data in localStorage.
- Do not bypass ownership/workspace authorization for convenience.
- Do not enable autonomous coding without verified sandbox isolation.
- Do not treat provider placeholders as live capabilities.
- Do not blindly enable PostgreSQL RLS without testing the existing authorization model.
- Keep the frontend state architecture unified rather than creating a second independent chat system.
- UI redesign is not the priority during backend hardening unless explicitly requested or required for functionality.
