# Jarvis 🤖

Jarvis is a local-first AI platform built around Ollama. Ollama runs the language models; Jarvis adds the product around them: chat, streaming, tool calling, memory, internet research, coding assistance, local voice, and local image generation.

## Current direction

- No external AI APIs for chat, coding, research synthesis, or voice.
- Ollama runs downloaded language models locally. Jarvis does not require training a model from scratch.
- Jarvis's research pipeline searches public webpages, gathers evidence, and uses the local Ollama model to synthesize findings. Live internet research still requires internet access.
- Image generation uses a direct local Diffusers integration, not ComfyUI and not a hosted image API.
- Jarvis voice profile: Piper English en_GB-alan-medium and Telugu te_IN-venkatesh-medium, with local speech recognition configured separately.
- Database and email are infrastructure integrations. Set them up privately and never commit credentials.

Not every feature works out of the box. Local model files and optional runtimes must be installed, and the full test/build suite still needs to be run against the current checkout.

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

Start Ollama, then pull the default local models:

    ollama pull qwen2.5:3b
    ollama pull qwen2.5-coder:3b

The default environment values are:

    BOBAI_OLLAMA_BASE_URL=http://127.0.0.1:11434
    BOBAI_OLLAMA_MODEL=qwen2.5:3b
    BOBAI_OLLAMA_CODING_MODEL=qwen2.5-coder:3b

You can choose other locally installed Ollama models in your private .env. For an 8 GB RAM computer, start with small quantized models and expect generation to be slower. Model quality and speed depend on hardware.

## Local image generation

Jarvis uses a local Diffusers pipeline directly, without ComfyUI and without a hosted generation API.

1. Install the optional dependencies into the Python environment selected by BOBAI_PYTHON: python -m pip install -r requirements-image.txt
2. Download a Diffusers-compatible image model to a local directory once, respecting its license and usage restrictions.
3. Set BOBAI_IMAGE_MODEL_PATH to that directory in .env.
4. Restart the API and test one 512x512 image first.

The model must already be on disk because inference uses local_files_only=True. CPU generation can be very slow and may run out of memory on an 8 GB laptop. Reference-image editing is not implemented in the local pipeline yet.

## Jarvis voice

Jarvis's voice service uses local Piper and local Whisper.cpp integration. For the same offline voice profile as Ai-Glasses, configure:

- English Piper model: en_GB-alan-medium.onnx and its matching .onnx.json
- Telugu Piper model: te_IN-venkatesh-medium.onnx and its matching .onnx.json
- Piper/espeak data path and Whisper model path for transcription

Set BOBAI_PIPER_EN_MODEL_PATH, BOBAI_PIPER_EN_CONFIG_PATH, BOBAI_PIPER_TE_MODEL_PATH, BOBAI_PIPER_TE_CONFIG_PATH, BOBAI_ESPEAK_DATA_PATH, and BOBAI_WHISPER_MODEL_PATH. Build the native media module using npm run native:media:build after installing its required native build tools. The voice route does not call a cloud speech provider.

## Start and verify

Run npm test, npm run build, npm run smoke, then npm run ai. The ai command runs the configured tests before starting the API and web app. A passing test suite is not a substitute for live tests with Ollama, database migrations, local model files, and microphone/audio playback.

## Security

Never commit .env, database URLs, credentials, or private keys. Keep Ollama bound to loopback unless you deliberately configure and secure a network deployment. Before exposing Jarvis to the public internet, review authentication, authorization, CORS, HTTPS, rate limits, data retention, and account isolation.

## Project status

Jarvis is an active work in progress. The feature setup checklist, feature inventory, and roadmap describe what still needs setup and verification.
