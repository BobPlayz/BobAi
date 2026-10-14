# Hosted AI providers are not used

BobAI's current architecture does not use OpenAI or other hosted AI providers for chat, coding, research synthesis, image generation, or voice.

- Chat and coding: local Ollama models.
- Image generation: local Diffusers model, directly integrated without ComfyUI.
- Research: BobAI's own web-search/evidence pipeline, with synthesis through local Ollama.
- Voice: local Piper and Whisper.cpp, using the English Alan and Telugu Venkatesh voice assets from the Ai-Glasses profile.
- Database: Neon PostgreSQL via the existing DATABASE_URL connection.
- Email OTP: Resend adapter, with SMTP as a fallback.

Neon and Resend are infrastructure services, not AI model providers. They still require internet access and user-managed credentials. Video generation is disabled until a local video runtime is implemented. Image editing with reference images is not implemented in the current local pipeline.
