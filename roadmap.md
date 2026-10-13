# BobAI UI Merge Roadmap

> **Purpose:** Merge the useful visual language and interaction ideas from the AI-Glasses dashboard into BobAI's existing website, while keeping BobAI's familiar ChatGPT-like conversation experience. This is the canonical plan for the UI merge and production hardening.
>
> **Status:** Planning baseline created on 2026-10-13. The local Ollama integration is already committed to `main`; this document does not claim the UI merge is complete. Update phase checkboxes only after the work is implemented and verified.

## Product decisions (keep these stable)

### The intended experience
- Keep BobAI as the single website, app shell, API, authentication system, conversation store, and memory system.
- Preserve a familiar ChatGPT-like layout: a compact left sidebar, clear conversation history, a central conversation area, and a bottom message composer.
- Borrow the AI-Glasses project's restrained dark interface and cyan accent, crisp borders, compact status indicators, and subtle motion. Use these as accents, not as a full-screen sci-fi control room.
- Keep the interface responsive and usable on desktop, tablet, and mobile.
- Make real chat the primary screen. Feature discovery should not push the conversation off-screen or turn the app into a dashboard.
- Keep the design consistent: dark background, readable text, neutral surfaces, and one cyan accent. No theme picker.

### UI features to retain or adapt
- Sidebar navigation and conversation history.
- New chat and existing conversation selection.
- Streaming assistant responses.
- A clean message composer with send/stop states and accessible keyboard behavior.
- Account/session controls that match BobAI's actual authentication routes.
- Useful file/image attachment controls only where the backend route exists and is tested.
- Clear loading, empty, offline, error, and retry states.
- Small service/model status only where it reflects actual backend status.
- Settings for capabilities that are implemented and genuinely user-configurable.
- Optional local Ollama text and vision, shown as available only when configured.
- Existing BobAI memory, research, speech, and file capabilities through their existing APIs and stores. Do not duplicate their backends.

### Remove or do not import
- All alternate visual themes and theme toggles, including legacy, light, glass, anime, and any per-feature theme mode.
- The JARVIS branding, reactor/orb centerpiece, perspective-grid HUD, corner brackets, fake CPU/RAM meters, decorative terminal log, and persistent sci-fi status theater.
- Hardware-specific controls: physical glasses pairing, ESP32 status/firmware, device camera/microphone switches, glasses speaker, hardware wake phrase, and firmware/BOM/wiring UI.
- The AI-Glasses Android-phone-camera workflow and device-specific live-capture flows.
- The separate AI-Glasses dashboard, SQLite memory/conversation store, and duplicate research implementation.
- Placeholder controls, fake integrations, mock metrics, or buttons that do not have a working, verified action.
- Redundant settings, duplicate navigation, and unnecessary dashboard cards.

### Implementation guardrails
- Reuse BobAI's existing routes, database, auth, design system, and components wherever possible.
- Do not replace working backend logic merely to copy the old dashboard.
- Do not introduce a second source of truth for conversations or memories.
- Do not expose Ollama or other local services to the public internet; local Ollama remains opt-in and loopback-only.
- Keep accessibility, reduced-motion preferences, keyboard navigation, mobile layouts, privacy, and upload validation in scope.
- Never label a feature “working” just because its code or API exists. Verify the actual end-to-end user journey.

---

## Phase 1/10 — Zero baseline and inventory

**Goal:** Establish the exact current state before changing the UI.

- [ ] Record the current `main` commit and ensure the working tree/branch is known before local work.
- [ ] Inventory BobAI web routes, shared layouts, chat components, styles, settings, auth, upload routes, and existing tests.
- [ ] Inventory AI-Glasses visual elements and classify each as: useful design reference, reusable interaction pattern, hardware-only, decorative-only, or duplicate backend.
- [ ] Capture baseline screenshots at desktop and mobile widths.
- [ ] Run the current build, lint/type checks, tests, repository preflight, and dependency audit; save existing failures separately from regressions.
- [ ] Map every visible UI control to the real route or handler it invokes.
- [ ] Confirm that the target is the BobAI website, not a new app or separate dashboard.

**Exit criteria:** A verified file/route map, baseline screenshots, and a list of current failures. No product behavior changed in this phase.

## Phase 2/10 — Visual system and design contract

**Goal:** Define one stable design language before moving components.

- [ ] Establish design tokens for background, surfaces, borders, primary text, muted text, cyan accent, focus rings, spacing, and radii.
- [ ] Use near-black page surfaces, subtle charcoal panels, thin neutral borders, and cyan for primary actions and focus.
- [ ] Keep typography clean and readable; avoid excessive letter spacing, all-caps labels, or terminal-style body text.
- [ ] Keep animations subtle and optional; honor `prefers-reduced-motion`.
- [ ] Remove legacy/light/glass/anime theme branches and theme-selection UI once no active feature depends on them.
- [ ] Define consistent button, input, textarea, menu, dialog, tooltip, message, and status styles.
- [ ] Check contrast and visible focus states.

**Exit criteria:** One default theme, shared tokens, no theme picker, and a short design reference in the repository.

## Phase 3/10 — App shell and navigation

**Goal:** Bring the AI-Glasses UI's useful layout ideas into BobAI without copying its hardware dashboard.

- [ ] Create or refine a compact left sidebar inspired by the familiar ChatGPT layout.
- [ ] Include only working destinations, such as new chat, conversation history, projects/library if supported, and account/settings.
- [ ] Add a clear collapse/expand behavior for the sidebar where supported.
- [ ] Keep account actions in a predictable location and respect existing auth routes.
- [ ] On narrow screens, turn the sidebar into a usable drawer rather than shrinking the chat.
- [ ] Preserve navigation state and avoid losing a draft when opening/closing the sidebar.
- [ ] Remove redundant dashboard cards and duplicate navigation.

**Exit criteria:** All visible navigation destinations work, the shell is responsive, and no hardware-only entry remains.

## Phase 4/10 — Chat surface and composer

**Goal:** Make conversation the visual center of BobAI.

- [ ] Keep a centered, readable message column with appropriate width and spacing.
- [ ] Make user and assistant messages easy to distinguish without oversized bubble chrome.
- [ ] Preserve streaming output, markdown, code blocks, links, and long-response readability already supported by the app.
- [ ] Build a bottom composer with multiline input, send state, disabled/loading state, and keyboard behavior.
- [ ] Add stop/cancel only if the underlying request can actually be cancelled safely.
- [ ] Add attachment affordances only for file types and routes supported by the backend.
- [ ] Keep an empty-state greeting and optional starter prompts understated and useful.
- [ ] Ensure errors preserve the user's draft and offer a real retry path.
- [ ] Test long conversations, narrow windows, browser zoom, and mobile keyboard behavior.

**Exit criteria:** A complete basic chat journey works with real APIs at desktop and mobile widths.

## Phase 5/10 — Conversation history and account flows

**Goal:** Connect the UI to BobAI's existing persistence rather than introducing new storage.

- [ ] Load and render the authenticated user's real conversations.
- [ ] Support opening a conversation and starting a new one.
- [ ] Verify rename/delete actions only if they are backed by real endpoints and authorization checks.
- [ ] Include useful loading, empty, unavailable, and error states.
- [ ] Ensure conversation ownership is enforced server-side.
- [ ] Confirm login, signup, logout, and expired-session states match existing authentication behavior.
- [ ] Verify that refreshing or reopening a conversation does not silently create duplicates.
- [ ] Avoid putting secrets, private prompts, or private conversation content into client logs.

**Exit criteria:** Conversation navigation and account flows pass end-to-end tests using real persisted data.

## Phase 6/10 — Capability integration, not dashboard sprawl

**Goal:** Expose existing BobAI capabilities only when their user journey is complete.

- [ ] Connect optional local Ollama status to a truthful UI state: disabled, unavailable, ready, or error.
- [ ] Provide local vision/image upload only when the matching API and validation are available.
- [ ] Reuse existing file understanding, OCR, research, and memory pathways rather than copying AI-Glasses implementations.
- [ ] Surface voice input/output only where the existing browser or backend integration works; request microphone permission explicitly.
- [ ] Keep capability controls contextual to the chat or a focused settings page.
- [ ] Do not add a separate JARVIS home screen, reactor visualization, or hardware-control panel.
- [ ] Hide or clearly mark unavailable capabilities instead of rendering nonfunctional buttons.
- [ ] Test capability failure, missing models, unavailable services, and offline behavior.

**Exit criteria:** Every capability shown in the UI maps to a tested BobAI route or a clearly labelled, intentionally unavailable state.

## Phase 7/10 — Settings, memory, and privacy UX

**Goal:** Make important controls understandable without turning settings into a cockpit.

- [ ] Keep one organized settings surface with only real, supported preferences.
- [ ] Explain local model setup and whether a feature needs internet, a local service, or browser permission.
- [ ] Reuse BobAI's existing memory store; show memory controls only when read/write/delete actions are supported and authorized.
- [ ] Provide clear controls and feedback for clearing data where supported.
- [ ] Use explicit permission prompts for microphone and file access; never enable sensitive capture silently.
- [ ] Keep local Ollama requests loopback-only and disabled by default unless the user opts in.
- [ ] Make privacy and data-handling explanations concise and accurate.
- [ ] Remove device pairing, physical privacy-switch status, wake phrase, glasses microphone, and glasses camera settings from the website.

**Exit criteria:** Settings contain no dead controls, permissions are explicit, and privacy states match backend behavior.

## Phase 8/10 — Accessibility, responsive polish, and performance

**Goal:** Make the merged UI feel finished across common devices.

- [ ] Verify keyboard-only navigation, focus order, dialogs, menus, and composer shortcuts.
- [ ] Add accessible labels and announcements for loading, streaming, errors, and status changes.
- [ ] Verify readable contrast, text resizing, browser zoom, and reduced-motion behavior.
- [ ] Test at common desktop, tablet, and phone widths.
- [ ] Avoid expensive always-running background animations and decorative canvases.
- [ ] Keep sidebar and conversation scrolling independent where appropriate.
- [ ] Optimize image previews and large conversation rendering.
- [ ] Check hydration warnings, console errors, layout shifts, and unnecessary re-renders.

**Exit criteria:** No blocking accessibility issues, no major responsive breakage, and no known critical console/runtime errors in core journeys.

## Phase 9/10 — Security, regression, and release candidate

**Goal:** Prove the new UI did not break the existing application or weaken security.

- [ ] Run format/lint, TypeScript checks, unit tests, integration tests, and production build.
- [ ] Add or update UI tests for sidebar, composer, streaming states, history, settings, uploads, and local-model states.
- [ ] Verify auth boundaries and user-to-conversation ownership.
- [ ] Verify upload size/type validation and safe rendering of untrusted text.
- [ ] Confirm no secrets or real environment files are committed.
- [ ] Run repository preflight and the dependency audit; remediate dependency advisories through reviewed, lockfile-consistent upgrades.
- [ ] Test offline mode with required local models already downloaded; clearly identify features that still require the internet.
- [ ] Compare baseline and candidate screenshots for accidental theme remnants or layout regressions.
- [ ] Confirm only intended files changed and that the integration is on `main` without creating a new branch unless explicitly approved.

**Exit criteria:** Build, tests, preflight, and security checks pass, or every remaining failure is documented and explicitly accepted before release.

## Phase 10/10 — Production-ready release

**Goal:** Ship a maintainable, secure, dependable BobAI UI.

- [ ] Verify production environment variables, database migrations, auth secrets, HTTPS, allowed origins, rate limits, and logging.
- [ ] Run a staging deployment and smoke-test signup/login, new chat, streaming, conversation reload, uploads, settings, and error recovery.
- [ ] Confirm optional local Ollama setup does not break deployments where Ollama is absent.
- [ ] Add safe operational logging and health checks without recording sensitive conversation contents unnecessarily.
- [ ] Verify backup/restore and database migration/rollback procedures.
- [ ] Confirm privacy policy and terms reflect actual data flows and optional external services.
- [ ] Run a final accessibility and responsive review.
- [ ] Tag the release only after the production checks pass; document rollback instructions and known limitations.
- [ ] Update this roadmap with the shipped commit, deployment URL, test evidence, and remaining non-blocking issues.

**Exit criteria:** The website is deployed, core journeys are smoke-tested in production, security/privacy configuration is reviewed, rollback is documented, and there are no known release-blocking defects.

---

## Definition of done for the UI merge

- [ ] BobAI retains its familiar ChatGPT-like chat experience and conversation-first layout.
- [ ] The useful AI-Glasses visual identity is reduced to a subtle dark/cyan visual language.
- [ ] There is one theme and no theme selector.
- [ ] Hardware-specific and duplicate prototype features are absent from the website UI.
- [ ] Every visible control has a real, tested action.
- [ ] Existing BobAI backend, auth, database, conversations, memory, research, and speech integrations remain the source of truth.
- [ ] Desktop and mobile flows are accessible and responsive.
- [ ] Build, tests, preflight, and dependency/security review have been completed and recorded.

## Change log

- **2026-10-13:** Created the roadmap following the repository integration. Local Ollama chat and vision are already integrated into BobAI's backend. The AI-Glasses dashboard is documented as a design reference, not as a second application to copy wholesale. UI merge phases remain planned until implemented and verified.
- **2026-10-13:** First UI pass committed to `main`: removed the legacy chat-rendering branch, locked the app to one dark/cyan theme by removing appearance/theme/accent controls, simplified the chat topbar, and replaced the multi-rail sidebar with a conversation-first sidebar containing working new-chat, search, select, pin, rename, delete-confirmation, and settings navigation. This is an initial pass, not production-ready; remaining phases and verification are still open.
