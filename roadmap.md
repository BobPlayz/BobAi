# BobAI: 10-Phase Product Roadmap

> **Product goal:** Build a polished, trustworthy, ChatGPT-style AI website that feels familiar and uncluttered, with useful privacy, research, voice, memory, and file features. This is a product roadmap, not a claim that every feature is already implemented.
>
> **Budget assumption:** ₹2,000 INR is the initial total budget for a domain and early running costs. Keep the first version inexpensive and avoid paid usage by default. Domain renewal and AI API usage are recurring costs, so check prices before purchasing.
>
> **Model decision:** Do **not** train a model for BobAI. Use a hosted AI provider through an adapter, with optional local Ollama support for users who choose it. Keep provider/model choices configurable so BobAI is not locked to one vendor.

## Product and design contract

### Visual direction
- Use a neat, calm, conversation-first layout inspired by the usability of ChatGPT.
- Keep **exactly two themes: Light and Dark**, with a visible toggle and a remembered preference.
- Use readable typography, consistent spacing, quiet borders, restrained accent color, and clear focus states.
- No sci-fi/HUD/JARVIS aesthetic, reactor/orb centerpiece, decorative particle scenes, fake hardware telemetry, terminal decoration, anime theme, or theme marketplace.
- No unnecessary dashboard cards. The chat is the home screen; settings should be plain, organized, and easy to scan.
- Responsive on mobile, tablet, and desktop; keyboard accessible; respect reduced-motion preferences.
- Keep real, useful interactions. No dead buttons, fake statuses, or controls for features that do not exist.

### Core feature goals
1. **AI chat and intelligence:** provider-based chat, streaming responses, sensible error handling, context limits, and transparent provider status.
2. **Age-appropriate controls:** age-aware safety settings and content boundaries appropriate for the service's intended audience. Never market a toggle as a way to bypass provider safety protections. Age verification or parental controls must be designed around applicable laws and platform policies before implementation.
3. **Source preferences:** let users choose research source types (for example, official documentation, academic material, reputable news, or general web sources) and clearly distinguish cited evidence from model-generated explanation. Preferences must actually affect the research pipeline.
4. **Research and agents:** research with source links, summaries, and traceable steps; agents should ask before consequential actions and have bounded tools, budgets, and timeouts.
5. **Natural voice-to-voice:** microphone input, speech recognition, model response, and natural spoken output with interruption/stop controls. Show microphone permission state clearly. Voice is optional, never silently always-listening.
6. **Image and file understanding:** secure uploads, supported file types, text extraction/OCR where useful, image understanding through the selected provider, upload progress, and clear size/type errors.
7. **Conversations and memory:** persistent conversation history and user-controlled memory. Explain what is saved, allow viewing/deleting memories when implemented, and keep user data separated.
8. **Account and privacy:** secure sign-in, account/session management, data deletion path, secrets kept server-side, and concise privacy explanations.
9. **Deployment and domain:** deploy to a stable HTTPS host and connect a purchased `.com` or `.ai` domain only after checking the full first-year and renewal price. Do not spend the whole ₹2,000 on the domain if that leaves no room for essential hosting.
10. **No model training:** use an existing hosted model API for the default path. Keep local Ollama as optional, not a requirement. Remove or archive unused training workflows only after confirming they are not used by CI, deployment, or other features.

### Important implementation rules
- Existing BobAI APIs, auth, database, conversation store, memory, research, and speech integrations remain the source of truth when they work.
- The optional Ollama integration remains disabled by default and loopback-only.
- Never expose provider keys to the browser or commit secrets.
- Research citations must point to sources actually retrieved; do not fabricate sources.
- Keep upload validation, rate limits, timeouts, cost caps, and abuse protections server-side.
- Do not claim age verification, parental controls, real-time voice, or research quality is complete until implemented and tested end to end.
- Treat ₹2,000 as a tight initial budget. Prefer free tiers and provider limits, and ask before enabling any paid API usage.

---

## Phase 1/10 — Zero: audit and baseline

**Goal:** Know exactly what exists before making product claims.

- [x] Record the intended product direction and exclude physical-glasses features from the website.
- [x] Create this 10-phase roadmap in the repository root.
- [x] Remove unused sci-fi intro components and decorative cinematic effects as recorded in the change log.
- [x] Inventory web routes, API route files, schema areas, major providers, auth, research, voice, uploads, and core controls in `docs/FEATURE_INVENTORY.md`. Static review only; it is not runtime certification.
- [x] Classify major features as implemented/unverified, partial, draft, or externally blocked in `docs/FEATURE_INVENTORY.md`.
- [x] Map the main chat, upload, voice, research, agent, memory, account, and theme controls to their handlers/endpoints in `docs/FEATURE_INVENTORY.md`.
- [ ] Capture desktop and mobile baseline screenshots for both themes.
- [ ] Run build, lint/type checks, tests, repository preflight, and dependency audit; record existing failures separately.

**Exit criteria:** A verified feature inventory, screenshots, and a baseline CI report. Do not call unverified features complete.

## Phase 2/10 — Clean UI and theme foundation

**Goal:** Make BobAI neat, calm, and easy to use.

- [x] Remove the unused sci-fi intro/scene components and decorative beams/particles as recorded in the change log.
- [x] Establish a conversation-first shell and a restrained visual direction.
- [x] Add a persistent Light/Dark theme preference and visible chat-header toggle for the chat workspace.
- [ ] Audit all routes and shared components for fixed dark-only colors, including the public landing/legal pages, message menus, markdown/code, uploads, dialogs, and error states. The chat composer, sidebar, empty state, and main message text now adapt to Light/Dark; a full visual audit is still required.
- [ ] Remove unused theme variants, theme pickers, decorative-only components, and obsolete CSS after checking imports and tests.
- [ ] Make settings plain and consistent with the main app; avoid animated dashboard-card layouts.
- [ ] Ensure mobile navigation is usable and the chat composer is not obscured by the keyboard.
- [ ] Check contrast, visible focus, text scaling, and reduced-motion behavior.

**Exit criteria:** Light and Dark both work throughout the app; no sci-fi-only visual system remains; no broken navigation or unreadable content.

## Phase 3/10 — Provider-based AI chat, without training

**Goal:** Use an existing chatbot model rather than training BobAI's own model.

- [x] Add an opt-in OpenAI-compatible hosted chat adapter with configurable model/base URL, server-side key handling, bounded request/response sizes, timeouts, and streamed output. See [Hosted AI setup](docs/HOSTED_AI.md).
- [ ] Choose and verify the production provider/model based on current quality, supported modalities, privacy terms, and cost. The hosted adapter is opt-in and still needs live end-to-end verification.
- [x] Keep hosted provider keys in server-side environment configuration and expose only configuration status to the browser; build/runtime verification is pending.
- [x] Add a visible Stop response control that aborts the active browser chat stream and preserves any partial text already received. Build/runtime verification is pending.
- [ ] Verify stream cancellation end to end and complete retry, timeout, and rate-limit coverage. The API now propagates disconnect cancellation into hosted and Ollama stream requests; native/production inference cancellation and runtime verification remain open.
- [x] Handle failed file uploads/file-to-AI processing and failed response regeneration without leaving upload indicators stuck or losing the chat's recovery state.
- [x] Convert chat HTTP failures into user-friendly messages instead of displaying raw response bodies.
- [x] Show the configured model/provider status in Settings → About, without exposing secrets. The status is configuration-level and not a live-availability guarantee; build/runtime verification is pending.
- [x] Add per-user rate limiting to the streamed AI chat endpoint. Build/runtime verification is pending.
- [ ] Add hard provider-side monetary budgets and verify global cost/usage safeguards before enabling paid API calls.
- [x] Keep local Ollama as a separate opt-in path; it remains disabled by default and is not required for hosted chat.
- [x] Keep model-training commands out of normal user-facing setup instructions.
- [x] Audit training references: removed all `model:*` training commands from the root package scripts and retired the standalone model-training workflow. Retained the `model-training/` source/artifact path because the optional native runtime still looks there for a prebuilt artifact; do not run training as part of normal setup.
- [x] Add tests for provider URL safety and missing-key/configuration status.
- [x] Add mocked tests for provider success, HTTP 401/429 failures, malformed/empty responses, and basic SSE streaming.
- [ ] Add streaming-disconnect and rate/usage-limit coverage.

**Exit criteria:** A new user can configure one supported provider and complete a streamed chat safely, without training a model.

## Phase 4/10 — Conversations, accounts, and memory

**Goal:** Make chat history reliable and memory transparent.

- [ ] Verify sign-up/sign-in/sign-out and session expiry end to end.
- [x] Replace the visible password/social login screen with a one-time name + email OTP quick-start flow; the API creates a user when needed and issues secure session cookies after verification. This is committed but not yet build/test verified.
- [x] Add setup notes for SMTP delivery, terms-version synchronization, session-cookie behavior, and MFA limitations in `docs/QUICK_START_AUTH.md`.
- [x] Defer profile display-name changes until the email OTP is successfully verified, preventing an unverified requester from changing another user's name.
- [x] Preserve the pending name and email across a browser refresh during OTP verification, and clear them after success.
- [x] Enforce the server's current terms version even when `BOBAI_TERMS_VERSION` is not explicitly set.
- [x] Add an authenticator-code challenge to the quick-start flow for accounts that require MFA, without bypassing MFA. Build/runtime verification is pending.
- [ ] Verify quick-start email delivery, existing-account handling, session refresh, sign-out, MFA edge cases, and legal-version configuration end to end.
- [x] Persist conversations and messages through authenticated, user-scoped conversation APIs; end-to-end verification is pending.
- [x] Support new chat, history loading, conversation switching, title search, rename, pin, and deletion where endpoints exist; build/runtime verification is pending.
- [ ] Verify refresh/reopen does not duplicate conversations or lose messages.
- [x] Add empty, loading, and failure states to the main chat/upload flows; verify offline recovery end to end.
- [x] Define memory as saved user facts plus relevance-based retrieval from the user-scoped memory store; memory review/edit/delete controls are available in Settings.
- [x] Add user-visible memory review, editing, individual deletion, and clear-all controls backed by authenticated database operations. Build/test verification is pending.
- [x] Make memory clearly configurable in Settings, explain that disabling it does not erase existing memories, and provide review/edit/delete/clear-all controls. Build/runtime verification is pending.
- [ ] Test user isolation and authorization for every conversation and memory endpoint.

**Exit criteria:** Conversation history and memory persist reliably, are user-scoped, and can be controlled without exposing another user's data.

## Phase 5/10 — Image and file understanding

**Goal:** Let users work with useful files and images safely.

- [x] Align the chat file picker with supported PDF, text, and PNG/JPEG/WebP upload formats; the API rejects unsupported image formats. Remaining MIME/extension edge cases still need final verification.
- [x] Implement image understanding through the configured hosted provider when available, with optional local Ollama vision. Live provider verification is pending.
- [x] Add file attachment previews, upload progress, and clear upload size/type errors; cancel/retry remains unfinished.
- [x] Add per-file upload cancellation, progress display, and an explicit cancel control. Automatic retry is not implemented; verify cancel/error cleanup during final testing.
- [x] Use OCR/text extraction for supported formats and return explicit extraction failures where available; end-to-end verification is pending.
- [x] Validate supported file signatures where available and enforce a 10 MB upload limit plus extracted-text bounds; verify page/pixel limits and edge cases.
- [x] Treat retrieved file knowledge as untrusted evidence rather than instructions in the chat system prompt.
- [ ] Define and enforce a category-specific uploaded-file retention schedule before public launch.
- [ ] Test unsupported files, oversized files, corrupt images, malicious text, and provider outages.

**Exit criteria:** Supported uploads work from selection to answer, with clear limits and no unsafe trust of file contents.

## Phase 6/10 — Research and source preferences

**Goal:** Deliver useful research with verifiable citations.

- [x] Audit the research subsystem: DuckDuckGo retrieval, bounded source fetching, and a research synthesis path exist in the API.
- [x] Build a research flow that retrieves sources, synthesizes evidence, and returns source links with numbered source references; end-to-end citation matching is still pending.
- [ ] Add source preferences such as official docs, academic sources, reputable news, and general web, but only where the backend can apply them.
- [x] Allow users to choose official/government, academic/research, reputable-news, or broad-web sources per Deep Research request; the preference is passed to search query construction and result filtering. Build/test verification is still pending.
- [x] Add optional saved research source defaults in Settings; individual Deep Research requests can override them. Build/runtime verification is pending.
- [x] Show research source titles and direct clickable links in the research panel, with source snippets and publication dates when available. Build/runtime verification is pending.
- [x] Instruct research synthesis to separate Findings, Interpretation, and Uncertainty / disagreements, and align displayed source entries to the evidence used for numbered citations. Confirm model compliance and citation accuracy in final testing.
- [ ] Do not fabricate citations or claim live browsing when no retrieval occurred.
- [x] Add search/source timeouts, source-count and response-size limits, URL/SSRF checks, deduplication, prompt-injection defenses, and graceful no-readable-evidence behavior; tests remain pending.
- [ ] Test stale sources, conflicting sources, dead links, empty results, and citation/claim matching.

**Exit criteria:** Research results have working source links, source preferences affect retrieval, and the UI clearly communicates uncertainty.

## Phase 7/10 — Agents and safe actions

**Goal:** Make agents useful without turning them into uncontrolled automation.

- [ ] Define a small set of clear agent tasks before adding a general-purpose agent builder.
- [x] Use a bounded tool registry with explicit schemas, permission checks, timeouts, step limits, and execution logging; end-to-end verification is pending.
- [x] Require explicit approval for tools marked as consequential before execution; verify coverage for every external side effect before launch.
- [x] Treat web pages, files, and tool output as untrusted input in the chat and research prompts.
- [x] Add a Stop agent control wired to the authenticated server-side queue cancellation endpoint. A structured action summary and end-to-end cancellation verification remain open.
- [ ] Add per-user quotas and provider cost limits. The authenticated agent endpoint now limits each user to three active tasks and five task submissions per minute; durable cross-instance quotas and hard provider-side monetary limits still require production configuration.
- [ ] Keep agents from bypassing age-appropriate safety policies or service permissions.
- [ ] Test prompt injection, tool errors, loops, timeouts, cancellation, and authorization boundaries.

**Exit criteria:** Each agent has a defined scope, bounded execution, truthful progress, and confirmation for consequential actions.

## Phase 8/10 — Natural voice-to-voice

**Goal:** Make speaking with BobAI feel conversational, not like a chain of awkward buttons.

- [x] Implement a browser microphone recording path with server-side transcription and a speech-synthesis endpoint; provider/latency/language tradeoffs still need a live evaluation.
- [x] Use explicit press-to-record controls; the app does not silently listen in the background.
- [x] Feed recorded speech transcripts into the same text composer used by chat.
- [x] Add stop controls for recorded input and read-aloud playback; true seamless voice-to-voice turn-taking and interruption during generation remain unfinished.
- [x] Show microphone recording state and surface permission/transcription errors.
- [x] Place dictation output in the editable chat composer before sending. Verify noisy-input/mobile-browser behavior during final testing.
- [ ] Support language/voice selection only when the chosen service actually supports it.
- [ ] Keep voice costs and third-party data processing transparent; use free/local options where practical.
- [ ] Test permission denial, noisy input, silence, interruption, network loss, long responses, and mobile browsers.

**Exit criteria:** A user can speak, receive a spoken response, interrupt it, and continue the same conversation reliably with explicit microphone control.

## Phase 9/10 — Age-appropriate controls, privacy, and production security

**Goal:** Build trust into the product from the beginning.

- [ ] Define the intended age range and safety behavior with applicable platform rules and legal requirements in mind.
- [x] Add a server-side age-appropriate safety baseline to the core chat system prompt; it cannot be overridden by user customization. This is a baseline safeguard, not age verification or a substitute for provider safety.
- [ ] Validate age-appropriate behavior across all model providers and tools; do not add an unrestricted toggle intended to evade provider protections.
- [ ] If age assurance or parental controls are needed, design them with privacy minimization and appropriate adult/legal guidance before collecting sensitive data.
- [x] Maintain a privacy-page draft describing provider processing, storage, memory, uploads, and retention, and make it follow the selected theme.
- [ ] Complete the provider inventory, operator identity, contact/grievance details, retention schedule, and legal review before treating the privacy page as final.
- [x] Add email-OTP reauthentication for account deletion, a visible confirmation flow, and scheduled permanent cleanup after the 30-day grace period. Build/test verification is pending.
- [x] Add a user-facing account data export control backed by the authenticated export endpoint. Build/test verification is pending.
- [ ] Verify auth, authorization, CSRF/CORS protections as applicable, rate limits, secret handling, secure cookies, and HTTPS.
- [ ] Review dependency advisories and update vulnerable packages with a consistent lockfile and tests.
- [ ] Avoid logging private prompts, access tokens, uploaded content, or voice recordings unnecessarily.
- [ ] Test cross-user data access, injection attempts, abuse limits, and failure recovery.

**Exit criteria:** Security checks pass or documented blockers are fixed before public launch; age and privacy claims match real behavior.

## Phase 10/10 — Domain, deployment, and production readiness

**Goal:** Launch a dependable public website without overspending.

- [ ] Compare current full first-year and renewal prices for a `.com` and `.ai` domain through reputable registrars. Do not decide based on promotional first-year pricing alone.
- [ ] Keep the initial total budget around ₹2,000 INR; prefer free hosting/database tiers where suitable and do not enable paid model usage without explicit budget controls.
- [ ] Choose a deployment target that supports the app's actual Next.js/API/database requirements; confirm free-tier limits before committing.
- [ ] Configure DNS, HTTPS, environment secrets, database migrations, allowed origins, and production auth settings.
- [ ] Configure health checks, useful privacy-safe logs, backups, and a restore/rollback plan.
- [ ] Test signup/login, chat streaming, conversation reload, memory controls, file/image upload, research citations, agents, voice, and theme persistence in staging.
- [ ] Test mobile layout, accessibility, performance, and both themes before launch.
- [ ] Run build, lint/type checks, all relevant tests, repository preflight, dependency audit, and deployment smoke tests.
- [ ] Add a status page or clear incident message if the service is unavailable.
- [ ] Record the release commit, deployment URL, DNS notes, known limitations, and rollback instructions here.

**Exit criteria:** Public HTTPS deployment works, core journeys are smoke-tested, spending is capped, backups/rollback are understood, and remaining issues are documented.

---

## Budget guardrails (₹2,000 initial budget)

- **Domain:** purchase only after checking current .com and .ai renewal prices. A .ai domain may consume a large share of the budget.
- **Hosting/database:** start with free tiers if they meet requirements, and verify quotas and sleep/usage limits.
- **AI provider:** keep development usage on free credits/free tier where available, add hard usage limits, and never promise unlimited free AI.
- **Voice:** prototype with browser or free/local components first; real-time hosted voice may incur recurring costs.
- **Reserve:** keep some budget for renewals or unexpected setup costs.
- **Rule:** no paid service is enabled by default without an explicit choice and clear cost information.

## Release definition of done

- [ ] Clean ChatGPT-style conversation-first UI, with working Light and Dark modes.
- [ ] No sci-fi/HUD/robot/reactor decoration or unused alternate themes.
- [ ] Hosted AI provider works without model training; optional local model remains optional.
- [ ] Conversation persistence and memory are reliable and user-controlled.
- [ ] Image/file understanding is validated and usable.
- [ ] Research source preferences and citations work end to end.
- [ ] Agent actions are bounded and require confirmation when consequential.
- [ ] Voice-to-voice is interruptible and permission-driven.
- [ ] Age-appropriate behavior and privacy/security claims are implemented, not just described.
- [ ] Domain and deployment are live over HTTPS with spending safeguards.
- [ ] Build, tests, accessibility checks, and security review are recorded.

## Change log

- **2026-10-13:** Created a ten-phase roadmap for merging the AI-Glasses UI ideas into BobAI without importing the physical-device product.
- **2026-10-13:** Fixed repository preflight allowlists so the root roadmap and quick-start auth guide are accepted Markdown files.
- **2026-10-13:** Added per-request Deep Research source preferences and source-filter unit tests; the tests have intentionally not been run yet because final verification is deferred until implementation work is complete.
- **2026-10-13:** Added saved-memory review, edit, individual-delete, and clear-all controls; added a user-facing account export control; and made the privacy page follow the selected theme. Build/runtime verification and account-specific end-to-end checks remain pending.
- **2026-10-13:** Added the web lint step to CI, a visible chat-stream Stop control wired to `AbortController`, per-user stream rate limiting, and an age-appropriate server-side safety baseline. CI/test execution is being deferred until the implementation pass is complete, as requested.
- **2026-10-13:** Added a dedicated MFA challenge step for quick-start sign-in when an account requires an authenticator. The profile name update now happens only after all sign-in checks pass; end-to-end verification is pending.
- **2026-10-13:** Added a safe provider/model configuration status panel to Settings → About. It explicitly distinguishes configuration status from live availability and never displays provider secrets.
- **2026-10-13:** Updated Next.js to 16.4.0 and refreshed compatible dependency fixes for proxy-addr, sharp, source-map-js, and brace-expansion. Build and tests passed on the security branch; npm audit still reports the upstream braces GHSA-vfj7-8cjw-p6xm, for which no patched upstream release is published as of this run. The remaining finding is in development lint tooling and is not silently suppressed.
- **2026-10-13:** Deep Research now renders source links as clickable entries with available snippets and publication dates, aligns the displayed source list to the exact fetched evidence used for citation numbering, and requests explicit Findings / Interpretation / Uncertainty sections.
- **2026-10-13:** Added `docs/FEATURE_INVENTORY.md`, a static route/API/schema/feature/control inventory and explicit external launch-blocker list. It is not a substitute for browser or runtime verification.
- **2026-10-13:** Removed the root package `model:*` commands and retired the standalone training workflow after checking that it was separate from CI/deployment. Retained model-training sources because the optional native inference runtime still expects a prebuilt artifact under that path.
- **2026-10-13:** Propagated client-disconnect cancellation from the API stream route through the chat engine into hosted and Ollama provider requests. Added a three-active-agent-task per-user limit; native/production inference cancellation and durable distributed quotas still need verification/design.
- **2026-10-13:** Added editable voice dictation to the active neural composer, per-file upload cancellation/progress controls, consistent supported image formats, and an agent Stop control wired to the server queue-cancel route. These code paths remain pending final build/test verification.
- **2026-10-13:** Added email-OTP reauthentication and a clear confirmation flow for account deletion, and hardened the existing 30-day retention cleanup to skip users who still own shared workspaces. Build/runtime verification remains pending.
- **2026-10-13:** Initial chat-first UI cleanup and local Ollama integration were committed to `main`; automated verification of all UI changes still needs to be run.
- **2026-10-13:** Replaced placeholder settings with real browser-local personalization/memory preferences, removed the misleading NSFW toggle and fake account/model claims, made the chat composer, sidebar, and empty state adapt to Light/Dark, removed the sci-fi orb from the empty state, and fixed the missing `ChatWindow` import. The message menus and public pages still need a complete Light/Dark and accessibility audit.
- **2026-10-13:** Added an opt-in OpenAI-compatible hosted chat adapter, server-side key configuration, endpoint validation, streaming support, setup documentation, and configuration safety tests. It remains opt-in because usage may cost money. Tests and build have not yet been run in this environment.
- **2026-10-13:** Expanded hosted-provider tests to cover a successful chat response, safe handling of HTTP 401/429 errors, malformed and empty responses, successful SSE streaming, and an empty stream. These tests are committed but still need to run in CI; stream-disconnect and usage-limit coverage remains open.
- **2026-10-13:** Replaced the visible password/social sign-in screen with a one-time name + email OTP quick-start. Added API endpoints to create a user when needed, update the display name, verify the email code, and issue secure session cookies. This depends on correctly configured SMTP in production and is not yet build/test verified. Existing API auth mechanisms remain available for backward compatibility; MFA-enabled accounts need a separate verification path.
- **2026-10-13:** Updated homepage entry points to use the single email quick-start and routed successful verification directly to chat, skipping the multi-step personalization onboarding. Added `docs/QUICK_START_AUTH.md` and `NEXT_PUBLIC_TERMS_VERSION` to the root environment example.
- **2026-10-13:** Added friendlier chat request failure messages for expired sessions, rate limits, service outages, and other failed requests. The user-facing retry/regenerate interaction still needs verification.
- **2026-10-13:** Tightened quick-start authentication so display names are only changed after a valid email code is consumed, and the API enforces the current terms version by default. These latest changes still require CI and end-to-end verification.
- **2026-10-13:** Improved chat recovery behavior for upload processing and regenerate failures, with per-file progress cleanup and readable failure messages. Build/tests have not yet been run.
- **2026-10-13:** Preserved the name and email in the OTP step across page refreshes so a user can complete verification without re-entering their name; clears the temporary details after successful verification.
- **2026-10-13:** Connected the active conversation ID to normal chat, file-processing, and regenerate API requests so the backend can persist turns under the same conversation. Passed image data URLs through the chat request into the existing vision pipeline. Corrected a misleading vision fallback that described an image as analyzed when it had only produced an embedding; the specialist now must return descriptive text, otherwise vision reports an explicit configuration error. End-to-end image understanding still depends on a real descriptive vision model and must be verified.
- **2026-10-13:** Connected the web chat client to the existing authenticated SSE `/stream` route and added incremental assistant-token rendering. The regular `/chat` endpoint no longer claims streaming readiness. Streaming still needs build/tests and an authenticated browser end-to-end check; file and regenerate calls use the same stream client and retain conversation IDs.
- **2026-10-13:** Fixed the stream disconnect watcher to observe the HTTP response closing, rather than the incoming request finishing. This avoids treating normal request-body completion as a client disconnect during generation; verify with an actual streamed response before release.
- **2026-10-13:** Added server-side hosted multimodal image analysis through the configured OpenAI-compatible endpoint when `OPENAI_API_KEY` is present, with supported-image/data-size checks and no browser exposure of credentials. Local Ollama vision remains an alternative. This path is implemented but still requires provider/model and end-to-end verification; image requests may incur provider usage costs.
- **2026-10-13:** Added unit coverage for hosted image-analysis request shape, server-side authorization, returned descriptions, and rejection of unsupported image data. The tests are committed but intentionally not run until the final verification pass.
- **2026-10-13:** Routed image files selected in the chat composer through the vision pipeline, while keeping ordinary document uploads on the text-extraction path. Inline images are limited to 1 MB for now to fit the API request budget; inline image bytes are excluded from conversation metadata persistence, so the conversation text remains saved but the image preview itself is session-only. End-to-end behavior still needs verification.
- **2026-10-13:** Fixed multi-file handling to carry forward each preceding attachment result and any per-file error instead of rebuilding every iteration from a stale React state snapshot.
- **2026-10-13:** Limited inline image payload forwarding to the latest user message so follow-up turns do not repeatedly resend old image bytes or trigger repeated image analysis unnecessarily.
- **2026-10-13:** Wired conversation rename and pin actions to the existing authenticated server update endpoint. Changed conversation deletion to remove the local entry only after server deletion succeeds and show an in-chat failure message if deletion fails, preventing silent history resurrection.
- **2026-10-13:** Updated microphone/read-aloud button contrast for both Light and Dark themes so the voice control remains visible in the clean UI. Theme and microphone permission behavior still need browser/accessibility verification.
- **2026-10-13:** Removed the chat image viewer fallback that silently contacted a third-party image service when an image failed to load. Failed images now remain a local UI error instead of triggering an unexpected external request.
- **2026-10-13:** Completed the latest chat UX wiring: image bytes are forwarded only for the newest user message, voice controls follow the active theme, assistant replies expose read-aloud with stop/cleanup, and failed image loads no longer trigger external fallback requests. Added hosted image-analysis tests; all recent code remains pending the final build/test/audit pass.
- **2026-10-13:** Connected the existing speech-synthesis endpoint to an explicit read-aloud button on assistant replies, while keeping the composer microphone control separate. Added a stop control and audio URL cleanup for playback interruption; local/external provider behavior still needs end-to-end testing.
- **2026-10-13:** Product direction clarified: clean layout, Light/Dark only, no sci-fi visuals, no model training, use an existing chatbot provider, and target an initial ₹2,000 budget for domain and early costs. Research/source preferences, age-appropriate controls, agents, natural voice, files/images, memory, and deployment are now explicit roadmap goals.
