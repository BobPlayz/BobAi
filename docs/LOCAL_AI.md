# Local AI integration

BobAI stays the main website, API, accounts, conversations, and memory system. Useful AI-Spects software is being reused as optional local-runtime features rather than adding a second dashboard or physical-glasses project.

## Reused rather than duplicated
- Local chat: optional Ollama model with a smaller fallback.
- Local image understanding: optional Ollama vision model for image uploads and chat attachments, with size/signature checks and loopback-only requests.
- Speech input/output: BobAI already has local Whisper.cpp and Piper integrations plus browser microphone/read-aloud controls.
- Memory and conversations: BobAI's authenticated PostgreSQL-backed stores remain canonical; the separate prototype SQLite store is not copied.
- Research: BobAI already has a research subsystem, so the prototype's separate search implementation is not copied.
- The ESP32 firmware, physical-device pairing API, hardware BOM, wearable wiring notes, and glasses-only dashboard are intentionally excluded because the target is a website.

## Enable local chat
Install Ollama, then pull the models while online:

\`\`\`powershell
ollama pull qwen2.5:1.5b
ollama pull qwen2.5:0.5b
ollama list
\`\`\`

Set these in your local API environment, not in a committed real \`.env\` file:

\`\`\`dotenv
BOBAI_OLLAMA_ENABLED=true
BOBAI_MODEL_NAME=ollama-local
BOBAI_OLLAMA_BASE_URL=http://127.0.0.1:11434
BOBAI_OLLAMA_CHAT_MODEL=qwen2.5:1.5b
BOBAI_OLLAMA_FALLBACK_MODEL=qwen2.5:0.5b
BOBAI_OLLAMA_TIMEOUT_MS=45000
\`\`\`

Restart the API. The existing BobAI web chat will use Ollama for text generation. The fallback is attempted when the primary request fails before output is returned.

## Enable local vision
\`\`\`powershell
ollama pull moondream:1.8b
\`\`\`

Set \`BOBAI_OLLAMA_VISION_ENABLED=true\` and \`BOBAI_OLLAMA_VISION_MODEL=moondream:1.8b\`. Vision is independent of the chat model. It accepts PNG, JPEG, and WebP images up to 8 MiB; PNG dimensions are checked against a 20-megapixel limit. Model requests are restricted to loopback.

## Offline testing
1. Download the required models and local speech assets while online.
2. Confirm chat, image analysis, transcription, and speech output work.
3. Disable online voice and research when strict offline operation is required.
4. Disconnect the internet and repeat the checks.

Ollama support is disabled by default. Tests do not prove that a model is installed or that laptop performance is acceptable. Do not expose Ollama or the BobAI API directly to the public internet.

## Cancellation and limits

The local Ollama stream adapter now accepts an optional cancellation signal and avoids starting its fallback model after cancellation. Confirm that the installed Ollama version, configured model, browser disconnect, and slow-generation paths behave correctly during final tests. Local mode is optional and disabled by default; loopback-only configuration must remain enforced.