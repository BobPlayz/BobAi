# BobAI feature setup checklist

This guide describes the current local-first direction. Chat, coding responses, research synthesis, and voice should use local software/models. Neon and Resend account setup can be completed separately; never commit their credentials.

## 1. Install and start the project

1. Install Node.js 24 or newer and Git.
2. Pull the latest main branch and run npm ci.
3. Copy .env.example to .env using the command for your terminal.
4. Configure DATABASE_URL with your Neon PostgreSQL connection string when you are ready to enable database-backed features.
5. Install Ollama and pull the default models:
   - ollama pull qwen3.5:4b
   - ollama pull qwen2.5-coder:3b
   - ollama pull qwen3-embedding:0.6b
6. Confirm Ollama is running at http://127.0.0.1:11434.
7. Run npm test, then npm run build. After failures are fixed, use npm run ai to start the API and web app.

Do not treat a successful start as proof that every feature works. The database must be reachable and migrated, and local models/assets must be installed.

## 2. Local chat and coding

The API uses Ollama's local chat endpoint. Default settings:

- BOBAI_OLLAMA_BASE_URL=http://127.0.0.1:11434
- BOBAI_OLLAMA_MODEL=qwen3.5:4b
- BOBAI_OLLAMA_CODING_MODEL=qwen2.5-coder:3b
- BOBAI_OLLAMA_VISION_MODEL=qwen3.5:4b
- BOBAI_OLLAMA_EMBEDDING_MODEL=qwen3-embedding:0.6b
- BOBAI_OLLAMA_NUM_CTX=4096
- BOBAI_OLLAMA_NUM_PREDICT=512

Jarvis shares one Qwen3.5 4B tag for chat and vision, and uses a dedicated Qwen2.5-Coder 3B model for coding. Before each model switch, Jarvis unloads other Ollama weights so separate tags do not remain resident together. Qwen3 Embedding 0.6B is used for semantic memory, then unloaded after each request. This improves quality but adds model-switch latency. If 4B causes paging or out-of-memory errors, change chat and vision to qwen3.5:2b. If semantic embedding reloads are too slow, set BOBAI_OLLAMA_EMBEDDING_MODEL=disabled to use the lexical fallback. Exact model and after-code steps are documented in [MODEL_SELECTION_8GB.md](MODEL_SELECTION_8GB.md). Coding requests are routed to the local model when recognized; this is code generation and debugging, not a fully autonomous repository-editing agent by itself.

No OpenAI key or hosted AI API is required for the local chat path.

## 3. Internet research

BobAI's research service runs its own query, result parsing, source ranking, caching, source filtering, evidence fetching, and local-model synthesis. It does not need a hosted AI API. Live web research still requires an internet connection and depends on the public search website being reachable. Verify every citation against the page text; search results and scraped pages can be incomplete or misleading.

Test:
- Empty, oversized, and malformed queries.
- Empty search results and temporary search failures.
- Broken or redirected pages.
- Whether the evidence excerpts support the final synthesis.
- Source preferences, caching, timeouts, and per-user quota behavior.

## 4. Local image generation, no ComfyUI

BobAI now has a direct Python Diffusers runner. It does not call a hosted image-generation API and does not use ComfyUI.

1. Install Python 3.11 or another version supported by the selected PyTorch/Diffusers packages.
2. Install the optional dependencies with: python -m pip install -r requirements-image.txt
3. Download a compatible Diffusers image model to a local folder. Downloading is a one-time setup step; check the model license and usage restrictions first.
4. Set BOBAI_IMAGE_MODEL_PATH in .env to the local model folder.
5. Set BOBAI_PYTHON if the API should use a specific Python executable.
6. Restart the API and test one 512x512 image.

Generation uses local_files_only mode, so the model must already exist on disk. The runner attempts to use CUDA if available and otherwise uses CPU. Image generation is serialized with Ollama and asks it to unload resident models before starting Diffusers. CPU generation can still be very slow and may exhaust 8 GB of RAM. Test a single 512×512 image before trying larger dimensions or multiple outputs.

## 5. Jarvis voice from Ai-Glasses

The selected offline voice profile is the same one established in Ai-Glasses:

- English: Piper en_GB-alan-medium
- Telugu: Piper te_IN-venkatesh-medium
- Speech recognition: local Whisper.cpp model
- No cloud voice provider

Configure these environment variables in the private .env:
- BOBAI_PIPER_EN_MODEL_PATH
- BOBAI_PIPER_EN_CONFIG_PATH
- BOBAI_PIPER_TE_MODEL_PATH
- BOBAI_PIPER_TE_CONFIG_PATH
- BOBAI_ESPEAK_DATA_PATH
- BOBAI_WHISPER_MODEL_PATH

The .onnx model and matching .onnx.json config files must exist locally. Set the paths to the assets you downloaded for Ai-Glasses or install matching copies into BobAI's local model directory. The Whisper model must also exist locally. The voice API currently uses BobAI's native media integration, so build it with npm run native:media:build after installing the required C++ build tools and compatible native dependencies. Run the voice status endpoint and test English, Telugu, empty audio, invalid WAV files, and missing model paths. Reuse the exact voice assets and licenses; do not assume the model files are already present in the BobAI repository.

The online Microsoft voice mode used in one Ai-Glasses setting is intentionally not used here because BobAI's voice must stay local/offline.

## 6. Database and email

Neon is compatible with the PostgreSQL connection used by the existing database package. Add the Neon connection string as DATABASE_URL in .env and run the documented database migration workflow after checking the target database. Do not paste database credentials into chat or commit them.

Resend is wired as the preferred OTP delivery method, with SMTP as a fallback. Set RESEND_API_KEY and RESEND_FROM_EMAIL in the private .env file and use a sender/domain verified by Resend. Production startup refuses to proceed without a complete Resend or SMTP configuration. Test real delivery, invalid keys, provider failures, OTP expiry/attempt limits, MFA, and account-deletion reauthentication. Test sending and verifying OTPs, expired codes, resend limits, account recovery, and deletion with disposable accounts.

## 7. Existing backend capabilities

| Feature | Current implementation direction | Still needs verification |
|---|---|---|
| Chat and streaming | Local Ollama adapter | Real local model response, cancellation, model-not-installed errors |
| Coding generation | Shared local Qwen3.5 2B profile by default | Prompt routing and quality on chosen model; optional dedicated coder requires extra memory |
| Internet research | BobAI search/evidence pipeline plus Ollama synthesis | Search reliability, source-to-claim grounding, stale/broken sources |
| Image generation | Local Diffusers pipeline, no ComfyUI | Python packages, local model folder, actual output and memory use |
| Voice | Local Piper + Whisper.cpp integration | Native media build, English/Telugu model paths, playback and transcription |
| Memory and conversations | PostgreSQL/Drizzle with semantic Qwen3 embeddings and lexical fallback | Neon connection, migrations, persistence, retrieval quality, cross-account isolation |
| Email OTP | Existing delivery abstraction | Resend adapter, secret configuration, real delivery and failure handling |
| Image understanding | Shared Qwen3.5 2B Ollama vision model by default | Real image inputs and descriptions on the target computer |
| Coding workspace agent | Separate sandbox bridge when configured | Requires a local bridge with strong authentication and sandbox verification |

## 8. Verification commands

Run these separately:

    npm test
    npm run build
    npm run smoke
    npm run audit

Review failures and audit findings instead of forcing upgrades blindly. The configured test suite does not prove live Neon/Resend behavior, local model inference, image generation, or voice playback. Verify those paths directly after setup.

## 9. Before public deployment

- Configure HTTPS, secure cookies, CORS, rate limits, backups, monitoring, and rollback.
- Confirm Ollama is not exposed to the public internet without an authenticated, secured gateway.
- Review each API route for authorization, validation, and cross-account isolation.
- Publish accurate privacy/terms, retention, operator, and support information.
- Test a fresh database migration and a database upgrade using disposable data.
- Do not claim a feature works until the real local model or infrastructure path has been exercised.


## 9. 8 GB RAM model profile and next steps

Use the [8 GB model selection and setup runbook](MODEL_SELECTION_8GB.md) for the exact model downloads, environment settings, sequential memory strategy, verification sequence, and the distinction between completed code and live environment validation.
