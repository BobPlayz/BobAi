# Local AI architecture

BobAI is local-first and uses Ollama as its language-model runtime. It does not train a model from scratch and does not call a hosted AI API for chat, coding generation, or research synthesis.

## Local chat and coding

- Install Ollama on the computer running BobAI.
- Pull the configured chat and coding models.
- Configure BOBAI_OLLAMA_BASE_URL, BOBAI_OLLAMA_MODEL, BOBAI_OLLAMA_CODING_MODEL, and BOBAI_OLLAMA_TIMEOUT_MS in the private .env file.
- BobAI routes recognized coding requests to the configured local coder model.
- The default model names are starter defaults, not a promise of speed or quality. Select models that fit available RAM/VRAM.

## Local image generation

BobAI calls a local Python Diffusers pipeline directly. ComfyUI is not required, and no hosted image API is used.

- Install optional packages from requirements-image.txt in the Python environment selected by BOBAI_PYTHON.
- Download a Diffusers-compatible model to disk and check its license.
- Set BOBAI_IMAGE_MODEL_PATH to the model folder.
- The runtime uses local_files_only=True and does not download model files at request time.
- The initial pipeline generates 512x512 PNG images and attempts CUDA when available, otherwise CPU. CPU generation may be slow or memory-intensive.
- Reference-image editing is not implemented in this local pipeline.
- Local video generation is intentionally disabled until a local video model/runtime and its lifecycle are implemented.

## Local Jarvis voice

- Piper English voice: en_GB-alan-medium.
- Piper Telugu voice: te_IN-venkatesh-medium.
- Whisper.cpp handles local speech transcription.
- Set the Piper model/config, espeak data, and Whisper model paths in .env.
- Build the native media module and test on the actual device.
- Microphone access must remain user-initiated. No background always-listening behavior is implied.

## Internet research

Research is BobAI's own pipeline: query construction, search retrieval/parsing, source ranking, evidence fetching, prompt-injection defenses, and synthesis through local Ollama. It needs internet access for live pages, but it does not require a hosted AI model API. Search results and web pages can be incomplete or adversarial, so citations must be checked against fetched evidence.

## Database and email infrastructure

Neon is used through the existing PostgreSQL/Drizzle connection. Set DATABASE_URL to the Neon connection string and run the project's migration workflow after reviewing the target database.

Resend is the preferred email OTP delivery method. Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env. A verified sender/domain is required at Resend. SMTP remains a fallback. No credentials belong in Git.

## Security

- Never expose Ollama's local endpoint or local coding execution bridge directly to the public internet.
- Keep secrets in the server environment only.
- Treat web pages, uploads, model output, and tool results as untrusted input.
- Keep coding execution sandboxed and require confirmation for consequential actions.
- Do not advertise the app as fully offline: live internet research and remote Neon/Resend services require connectivity.
- Do not claim a feature is verified until it has been exercised with real local models and infrastructure.
