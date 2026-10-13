# BobAI implementation inventory

**Review date:** 2026-10-13  
**Review type:** Static repository review only. No route, browser, database, provider, or deployment behavior is certified by this document. Run the deferred verification suite after implementation is complete.

## Web route inventory

| Route | Purpose | Static status | Notes |
|---|---|---|---|
| `/` | Landing / entry | Partial | Public marketing content; theme and responsive review still needed. |
| `/chat` | Main conversation workspace | Implemented, unverified | Uses `useChat`, sidebar, topbar, composer, and chat window. |
| `/login` | Name + email OTP quick-start | Implemented, unverified | MFA challenge exists for accounts that require it. SMTP and session flows need live checks. |
| `/signup` | Legacy/signup entry | Partial | Confirm redirects and eliminate confusing duplicate auth entry points. |
| `/verify-otp` | OTP verification | Partial | Legacy compatibility route; confirm whether still linked and safe to retain. |
| `/onboarding` | Personalization onboarding | Partial | Quick-start intentionally routes directly to chat. |
| `/settings` | Preferences, memory, provider status, export, deletion | Implemented, unverified | Includes local preferences and authenticated account controls. |
| `/privacy` | Privacy notice draft | Draft | Operator identity, contact, provider list, retention schedule, and legal review remain required. |
| `/terms` | Terms draft | Draft | Review terms against actual product behavior and intended age range. |
| `/about` | Product information | Partial | Check theme and remove any claims not backed by shipped features. |
| `/contact` | Contact information | Draft | Confirm a real support/grievance contact before launch. |
| `/faq` | Frequently asked questions | Partial | Check all answers against actual availability and cost. |
| `/thank-you` | Post-action page | Partial | Confirm actual navigation target. |
| `/waitlist` | Waitlist | Partial | Confirm whether the waitlist is real, or remove the route and entry points. |

## API route inventory

The API route directory contains: `account`, `admin`, `agentOffice`, `agents`, `apiKeys`, `auth`, `automation`, `capabilities`, `chat`, `collaboration`, `conversations`, `deepResearch`, `ffmpeg`, `files`, `health`, `images`, `mcp`, `memory`, `messages`, `model`, `modelAgents`, `music`, `notifications`, `oauth`, `projects`, `prompts`, `reminders`, `research`, `researchBriefs`, `runtimeAdmin`, `search`, `settings`, `skills`, `stream`, `study`, `tools`, `vision`, `voice`, `webhooks`.

Static status across these routes is **implemented or partial, not runtime-certified**. Public launch requires a route-by-route authorization, input-validation, rate-limit, CORS/CSRF, error-handling, and data-isolation review. Health routes expose liveness/readiness; production readiness depends on environment and database configuration.

## Core implementation map

| Capability | Main implementation | Static status | Remaining verification |
|---|---|---|---|
| Hosted AI | `apps/api/src/services/openAIProvider.ts`, `modelProvider.ts`, `chatEngine.ts` | Implemented, opt-in | Confirm production provider/model, privacy terms, modalities, cost controls, and live streamed response. |
| Streaming | `apps/api/src/routes/stream.ts`, `apps/web/src/lib/api.ts` | Implemented | Confirm LF/CRLF frames, abort/disconnect handling, partial response persistence, retries, and rate limits. |
| Accounts / OTP | `apps/api/src/routes/auth.ts`, `apps/web/src/app/login/page.tsx` | Implemented | SMTP, existing account, MFA, terms version, refresh, sign-out, expiry, and cookies. |
| Conversations | `apps/api/src/routes/conversations.ts`, `apps/api/src/store/conversationDb.ts`, `apps/web/src/hooks/useChat.ts` | Implemented | Refresh/reopen behavior, ownership isolation, duplicate turns, deletion/rename/pin persistence. |
| Memory | `apps/api/src/routes/memory.ts`, `apps/api/src/store/memoryDb.ts`, Settings | Implemented | Per-user isolation, consent semantics, clear-all, disabled-memory behavior, and sensitive-content checks. |
| Uploads | `apps/api/src/routes/files.ts`, `documentIndexer.ts`, `ocr.ts`, `malwareScanner.ts` | Implemented | Supported-type consistency, limits, corrupt files, page/pixel limits, cancellation, retention, and outage behavior. |
| Vision | `apps/api/src/services/vision.ts`, `openAIProvider.ts`, `visionChat.ts` | Implemented, provider-dependent | Live image request with a model that truly supports image input. |
| Research | `apps/api/src/services/research.ts`, `deepResearch.ts`, AssistantHub | Implemented, unverified | Citation-to-evidence matching, stale/conflicting sources, dead links, empty results, source preference behavior. |
| Tools / agents | `toolRegistry.ts`, `toolExecution.ts`, `toolLoop.ts`, `agents.ts`, `agentTasks.ts` | Implemented, partial | Quotas/cost limits, end-to-end approval coverage, cancel/timeout/loop and cross-user tests. |
| Voice | `apps/api/src/routes/voice.ts`, `services/voice.ts`, `VoiceButton.tsx`, NeuralComposer | Implemented, provider-dependent | Permission denial, noisy input, editing transcript, mobile support, language/voice options, interruption. |
| Account deletion/export | `apps/api/src/routes/account.ts`, `accountPurge.ts`, `retention.ts` | Implemented, unverified | Confirm export contents, reauthentication, grace period, workspace ownership and final deletion. |
| Theme | `ThemeProvider.tsx`, neural shell/composer/sidebar | Partial | Public pages, message menus, markdown/code, upload panels, dialog states, contrast, keyboard, reduced motion. |

## Main UI control-to-handler map

| Control | Handler / endpoint | Known gap |
|---|---|---|
| Send chat message | `useChat.send` → `sendMessage` → `POST /stream` | Verify authenticated end-to-end stream and persistence. |
| Stop response | `useChat.stop` → `AbortController` | Verify server generation actually stops and partial text remains. |
| Attach file | `NeuralComposer` → `useChat.handleFiles` → `POST /files/upload` | Cancellation is wired; test transfer and downstream processing behavior. |
| Voice dictation | `VoiceButton` → `transcribeAudio` → composer text | Confirm transcript can be edited before sending, plus mobile/noisy-input behavior. |
| Read answer aloud | `VoiceButton` → `synthesizeSpeech` | Verify stop/cleanup and provider fallback. |
| New chat / switch | `useChat.newChat`, `setActiveId` | Verify reload, server-generated IDs, and no duplicates. |
| Rename / pin / delete conversation | `useChat` → conversation API | Pin/rename failures currently need visible feedback review; test server persistence. |
| Research | `AssistantHub.run` → `deepResearch` → `POST /deep-research` | Confirm citations correspond to fetched evidence and preferences actually filter sources. |
| Run coding agent | `AssistantHub.run` → `runCodingAgent` → `POST /agents/user/run` | Stop/cancel control added; verify ownership and cancellation end-to-end. |
| Memory controls | Settings → memory API | Test isolation and deletion behavior with separate test users. |
| Export account | Settings → account export API | Confirm archive/download UX and sensitive data scope. |
| Delete account | Settings → OTP reauthentication → scheduled deletion | Confirm production mail delivery and workspace-owner resolution. |
| Theme toggle | `ThemeProvider.toggleTheme` | Verify all routes and persist/reopen behavior. |

## Database schema inventory

The schema directory includes users, sessions, email OTPs, password resets, conversations, messages, settings, memories and memory embeddings/history, workspaces and memberships, projects and project files, uploads and document chunks, tool approvals/logs, agent runs/tasks/artifacts, research sessions/claims/briefs/quotas, usage records, model providers, API keys, OAuth/MFA state, notifications, reminders, integrations, organizations/members, subscriptions/billing plans, workflow runs/workflows, webhooks/deliveries, and supporting idempotency/search/file-share tables.

This is a directory-level inventory, not a migration/schema compatibility audit. Verify migrations against a fresh database and an upgrade of the intended production database during final verification.

## Explicit external launch blockers

These cannot safely be completed by code changes alone:

1. Choose the real production AI provider/model and accept its data-processing terms.
2. Set hard provider/account spending limits in the provider dashboard and decide the maximum monthly spend. Keep paid AI disabled until this is done.
3. Configure production SMTP, database, allowed origins, secrets, and session settings.
4. Choose and purchase a domain only after comparing full first-year and renewal prices.
5. Choose hosting/database tiers and confirm they fit the ₹2,000 initial budget and ongoing costs.
6. Publish the operator identity, support/privacy contact, grievance channel, complete provider inventory, and reviewed retention policy.
7. Obtain qualified legal/adult guidance on the intended age range and any required child-data consent or age-assurance mechanism.
8. Supply deployment credentials and approve DNS changes; configure HTTPS, backups, monitoring, and rollback.
9. Run the final CI/build/test/audit/smoke-test pass after the implementation pass is complete.
10. Capture real desktop/mobile screenshots in both themes and review accessibility on actual target browsers/devices.


## Latest implementation notes (2026-10-13)

- The public SiteNav and landing page now consume the shared theme provider; the cookie-consent UI is placed inside that provider and follows the selected theme.
- Leaving the chat aborts the active stream and in-progress upload controllers.
- Client-disconnect cancellation is passed from the stream route through `runStream` and the model-provider adapters. This path needs tests against native/production providers, local Ollama, hosted fetch, partial message persistence, and abort timing.
- When research pages yield no readable evidence, search-result links are retained for transparency rather than returning an empty source list.
- If distributed rate limiting is configured, failure of the shared limiter now fails closed. Confirm this matches the deployed backend and expected availability policy.

These are static code observations, not verified outcomes. The roadmap's test/build/security pass is still pending.