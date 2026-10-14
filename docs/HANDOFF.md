# Jarvis backend handoff

**Updated:** 2026-10-14  
**Repository:** https://github.com/BobPlayz/BobAi  
**Working branch:** `main` only. Do not create or use feature branches.

## Working rules

- Finish implementation before sending a progress report. The user explicitly requested code changes directly in the repository, on `main` only.
- Do not claim a feature works because its source exists. Separate code implementation, CI verification, and real local-runtime verification.
- Keep Jarvis local-first: no hosted AI-model APIs and no model training. Neon/PostgreSQL and Resend/SMTP are infrastructure services, not inference providers.
- Do not make purchases, enable paid services, deploy production, change DNS, or expose secrets without explicit approval.
- Keep user-facing language age-appropriate. Do not provide a bypass for provider safety, authentication, approvals, or spending controls.

## Current architecture and implementation

- **Chat/coding:** `apps/api/src/services/ollamaProvider.ts` and `modelProvider.ts`. Defaults: `qwen2.5:3b` and `qwen2.5-coder:3b`. Streaming cancellation is propagated to Ollama. Models must be pulled locally.
- **Image understanding:** uses local Ollama multimodal chat through `BOBAI_OLLAMA_VISION_MODEL`, default `moondream:1.8b`. Input validation checks base64, image signatures, MIME consistency, and size. The system prompt treats text/instructions in images as untrusted. No custom trained vision checkpoint is required.
- **Image generation/editing:** direct local Diffusers pipeline in `scripts/local_image_generation.py`, without ComfyUI or a hosted image API. Text-to-image uses `BOBAI_IMAGE_MODEL_PATH`; image-to-image uses `AutoPipelineForImage2Image` with up to four reference images, each up to 2 MB. A compatible local model and optional Python dependencies must be installed. The subprocess is cancelled when the client disconnects.
- **Research:** basic search and Deep Research use the local query/retrieval/evidence pipeline with synthesis through Ollama. Internet is needed for live search, but no hosted AI-model API is used. Cancellation reaches active search requests, retry waits, source fetches, and synthesis.
- **Voice:** local Piper synthesis and Whisper.cpp transcription through the native media addon. The browser converts microphone recordings to PCM16 WAV. Native libraries, model files, eSpeak data, and a compiled addon are environment prerequisites. End-to-end audio behavior and native runtime performance remain unverified.
- **Memory/conversations:** PostgreSQL/Drizzle persistence, embeddings, history, and user controls. Memory project IDs are checked against the selected workspace and archived/deleted projects are rejected. Per-user isolation still requires full end-to-end verification.
- **Authentication/infrastructure:** email OTP and MFA/session code exists; real delivery needs a configured Resend sender or SMTP, a database, and correct production environment values.
- **Payload limits:** global JSON defaults to 2 MB. Dedicated bounded limits are configured for image generation (12 MB), direct vision (17 MB), chat attachments (5 MB), voice transcription (34 MB), and media endpoints (44 MB). Oversized and malformed JSON map to HTTP 413 and 400.
- **Branding:** user-facing runtime labels use Jarvis. Legacy package scopes and `BOBAI_*` environment names remain compatibility identifiers. The GitHub repository slug still needs manual rename if the user wants the URL changed.

## Latest code changes

- Added disconnect-aware cancellation for research, local image generation, and direct vision analysis.
- Added local image-to-image editing and strict reference-image validation.
- Replaced the unavailable custom vision checkpoint with local Ollama multimodal inference and included the vision model in Ollama readiness reporting.
- Added endpoint-specific body limits, accurate body-parser errors, image route validation, and workspace-scoped memory project validation.
- Added regression tests for research cancellation, image payload validation, local vision request routing, and the vision prompt-injection instruction.
- Added Python AST syntax validation to both CI workflows, and made the backend workflow watch the local media script/dependency manifest.

## Verification status

- GitHub Actions has passed for recent intermediate commits, including the build/test workflow on commit `b0df8320`. The newest commit's CI, CodeQL, repository-preflight, and Lighthouse results must be checked before calling the implementation pass verified.
- CI cannot prove real Ollama, Diffusers, Piper, Whisper.cpp, database, SMTP/Resend, or browser microphone behavior. Those require local assets/configuration and end-to-end runtime tests.
- The native media addon is synchronous and should be performance-tested under real voice use; do not claim production-grade latency or interruption until tested.

## Remaining owner/environment tasks

1. Install Ollama and pull the three configured models: `ollama pull qwen2.5:3b`, `ollama pull qwen2.5-coder:3b`, and `ollama pull moondream:1.8b`.
2. Install `requirements-image.txt`, download a compatible Diffusers model into the configured local path, check its license, and test image generation/editing. CPU generation may be very slow on modest hardware.
3. Install Piper/Whisper.cpp native dependencies, build `native/media`, configure voice model/config/eSpeak paths, and test English/Telugu transcription and playback.
4. Configure `DATABASE_URL`, run reviewed migrations, and configure Resend or SMTP if email login is required.
5. Complete runtime tests for authentication/MFA, conversation reload, user isolation, memory controls, uploads, citation quality, tool approvals/cancellation, and browser audio.
6. Before public launch, finalize retention policy, operator/support contact, privacy/terms, age-appropriate safeguards, deployment secrets, health checks, backups, staging tests, and responsible adult/legal review.
7. Choose hosting only after confirming local inference requirements. Free frontend hosting alone cannot run Ollama/Diffusers/native audio models.

- Raised the local Ollama vision JSON request cap to 17 MB so a valid 12 MB image plus base64 and JSON envelope fits under the service limit.

- README and API guide now document the current local Ollama vision model and Diffusers image-editing path, and API route examples match the actual root-mounted route structure.

- The `/voice/turn` endpoint now chains local Whisper.cpp transcription, bounded Ollama chat context, and local Piper speech synthesis, with request validation and client-disconnect checks between stages.

- Voice-turn orchestration reads the chat engine’s `message.content` response field before passing text to local Piper.

- Fixed production CSRF cookie detection consistency by aligning authentication cookie names with the Jarvis cookie names checked by the API security middleware. The local `/voice/turn` endpoint also receives the same 34 MB JSON limit as transcription so base64 audio is not rejected by the global 2 MB parser.

- Updated the authentication middleware and malformed-cookie regression test to use the same `jarvis_access` cookie as the auth route and CSRF middleware, closing a session-cookie naming mismatch across the API.
