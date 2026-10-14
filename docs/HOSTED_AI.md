# Retired: hosted AI provider

BobAI's current direction is local-first. This document is kept temporarily so old links do not break, but its former hosted-provider setup is no longer supported by the active backend.

Use Ollama for chat and coding:
- Install Ollama locally.
- Pull the configured models shown in .env.example.
- Set BOBAI_OLLAMA_BASE_URL, BOBAI_OLLAMA_MODEL, and BOBAI_OLLAMA_CODING_MODEL.
- Follow the current setup steps in README.md and docs/FEATURE_SETUP_GUIDE.md.

Image generation uses the local Diffusers runner and a model directory configured through BOBAI_IMAGE_MODEL_PATH. Voice uses local Piper/Whisper integrations. Research uses BobAI's own search/evidence pipeline and the local Ollama model for synthesis.

Do not configure an OpenAI key or any hosted AI endpoint for the current local-first build. Database and email delivery are separate infrastructure concerns; Neon and Resend must be configured and tested independently.
