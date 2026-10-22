# Jarvis 🤖

Jarvis is a local-first AI platform built around Ollama. Ollama runs the language models; Jarvis adds the product around them: chat, streaming, tool calling, memory, internet research, coding assistance, local voice, and local image generation.

## Current direction

- The default setup uses local Ollama for chat, coding, and research synthesis, with no external AI-model API key.
- Ollama runs downloaded language models locally. Jarvis does not require training a model from scratch.
- Jarvis's research pipeline searches public webpages, gathers evidence, and uses the local Ollama model to synthesize findings. Live internet research still requires internet access. The chat tool router also has a no-key Open-Meteo tool for live weather and a sourced web-search tool for current cricket scores; these depend on the hosted API having outbound internet access and must not invent results when sources are missing.
- Image generation uses local Diffusers only. It needs no image API key and sends no prompts to a hosted image provider.
- Jarvis voice profile: Piper English en_GB-alan-medium and Telugu te_IN-venkatesh-medium, with local speech recognition configured separately.
- Database and email are infrastructure integrations. Set them up privately and never commit credentials.

Not every feature works out of the box. Local model files and optional runtimes must be installed, and real inference still needs to be verified on the target computer.

## Hosting and production setup

Vercel can host the web app and the Express API, but it cannot connect to Ollama at `http://127.0.0.1:11434` on your personal computer. For a hosted demo, set `BOBAI_OLLAMA_BASE_URL` to a reachable, authenticated HTTPS Ollama gateway or host the API alongside Ollama on a machine you control. Never expose Ollama's unauthenticated port directly to the public internet.

Production also requires a reachable PostgreSQL/Neon database, explicit HTTPS values for `CORS_ORIGIN`, `BOBAI_WEB_URL`, and `BOBAI_AUTH_REDIRECT_BASE_URL`, a random `BOBAI_AGENT_KEY` of at least 32 characters, a 32-byte `BOBAI_MFA_ENCRYPTION_KEY` encoded as 64 hex characters or Base64, and a working Resend sender or SMTP configuration for email verification. Keep all secrets in the hosting provider's environment settings, not in Git.

Vercel's free deployment/build limits can temporarily prevent a new deployment. A successful Git push does not by itself prove that production has updated; verify the deployment and test email verification and a real chat before presenting the hosted demo.

## Requirements

- Node.js 24 or newer and npm
- Ollama installed locally
- PostgreSQL or a Neon PostgreSQL connection for database-backed features
- Python 3.11 recommended for optional local image generation and voice runtime setup
- Enough disk and RAM for the model files you choose

## Install

Clone the repository, enter the folder, and run npm ci. Create a private .env file by copying .env.example. On Windows Command Prompt use copy .env.example .env; in PowerShell use Copy-Item .env.example .env; on macOS/Linux use cp .env.example .env.

Set DATABASE_URL after creating your database, then configure the local model settings below.

## Ollama chat and coding

Start Ollama, then pull the default local model:

    ollama pull qwen3.5:4b

The default environment values are:

    BOBAI_OLLAMA_BASE_URL=http://127.0.0.1:11434
    BOBAI_OLLAMA_MODEL=qwen3.5:4b
    BOBAI_OLLAMA_EMBEDDING_MODEL=disabled
    BOBAI_OLLAMA_NUM_CTX=3072
    BOBAI_OLLAMA_NUM_PREDICT=256

The default uses one Ollama model, Qwen3.5 4B, for chat, coding, research synthesis, and image understanding. Semantic embeddings are disabled by default to avoid downloading or loading a second model; memory can use the application's available non-embedding retrieval fallback. Context/output sizes are capped, and image generation unloads Ollama weights before starting Diffusers.

The shared Qwen3.5 4B model is the single-model default across chat, coding, research synthesis, and image understanding. If 4B causes paging or out-of-memory errors, set `BOBAI_OLLAMA_MODEL=qwen3.5:2b` to switch all four together. `BOBAI_OLLAMA_CODING_MODEL` and `BOBAI_OLLAMA_VISION_MODEL` are optional overrides, not needed for the default setup. See [the 8 GB model and setup runbook](docs/MODEL_SELECTION_8GB.md).

## Image generation: Local-only mode

Jarvis image generation runs locally. No hosted image API or API key is used.

### Local mode (offline and free after setup)

Keep:

    BOBAI_IMAGE_MODEL_PATH=models/image/dreamshaper-8

On Windows, copy `.env.example` to `.env`, install Node dependencies, then run:

    npm run setup:image-generation
    npm run test:image-generation

The setup command creates a dedicated Python 3.11 virtual environment, installs CPU-only PyTorch plus Diffusers dependencies, downloads Tiny-SD by default, and writes the local Python/model paths into your private `.env`. It does not overwrite unrelated environment settings. The first setup needs internet; after the model is downloaded, inference uses local files only. Tiny-SD is the lower-memory default for an 8 GB CPU-only laptop. For the higher-quality DreamShaper 8 profile, run `npm run setup:image-generation -- -Profile quality`, but expect much slower inference and a higher risk of running out of memory. Review the selected model's license before using or redistributing outputs.

The smoke test performs actual 512x512 CPU inference and saves `storage/image-generation-smoke.png`. Even Tiny-SD CPU inference can be slow on an 8 GB laptop. DreamShaper can take substantially longer and may fail if other applications consume too much RAM. Close heavy applications before running image generation. Jarvis serializes local image inference with Ollama and unloads Ollama model weights before generation to reduce memory pressure.

### API and history

The authenticated API endpoint is `POST /images/generate` with JSON such as `{"prompt":"a tiny robot in a cyan glass laboratory","width":512,"height":512,"count":1}`. The response contains generated PNG data URLs and stores the image in the user's image history. Generated images can be restored from history. Real inference still needs to be verified on the target computer; a passing code build does not prove the local model or remote account is configured.

## Jarvis voice

Jarvis's voice service uses local Piper and local Whisper.cpp integration. For the same offline voice profile as Ai-Glasses, configure:

- English Piper model: en_GB-alan-medium.onnx and its matching .onnx.json
- Telugu Piper model: te_IN-venkatesh-medium.onnx and its matching .onnx.json
- Piper/espeak data path and Whisper model path for transcription

Set BOBAI_PIPER_EN_MODEL_PATH, BOBAI_PIPER_EN_CONFIG_PATH, BOBAI_PIPER_TE_MODEL_PATH, BOBAI_PIPER_TE_CONFIG_PATH, BOBAI_ESPEAK_DATA_PATH, and BOBAI_WHISPER_MODEL_PATH. The default Windows setup installs Piper CLI and faster-whisper into a separate local Python environment, downloads the model assets, and configures Jarvis to use them without a cloud speech provider. The optional native media addon can still be used when compatible C++ libraries are available.

## Start and verify

For the ordered end-to-end completion checklist, including local voice setup, runtime verification, launch blockers, and definition-of-done criteria, see [the final completion checklist](docs/FINAL_COMPLETION_CHECKLIST.md). On Windows, run `npm run setup:local-media` to prepare Whisper/eSpeak assets, download the free Alan Medium British and Venkatesh Telugu Piper voices, configure local voice paths, and install Tiny-SD for local image generation. This setup may take a while and needs internet for downloads. Local speech synthesis and recognition use the Python/CLI fallback by default; the native addon is optional. Then run `npm run test:image-generation` to verify actual local image inference. The web app and API must run on the same computer as Ollama and local media for these localhost-only services to be reachable.

Run npm ci, npm test, npm run build, npm run smoke, and npm run audit. After those pass, install the local models and media assets, configure the private .env, run the database migration workflow, and launch with npm run ai. A passing test suite is not a substitute for live tests with Ollama, database migrations, local model files, and microphone/audio playback.

## Security

Never commit .env, database URLs, credentials, or private keys. Keep Ollama bound to loopback unless you deliberately configure and secure a network deployment. Before exposing Jarvis to the public internet, review authentication, authorization, CORS, HTTPS, rate limits, data retention, and account isolation.

## Project status

Jarvis is an active work in progress. The feature setup checklist, feature inventory, and roadmap describe what still needs setup and verification.
