# Jarvis model profile for an 8 GB Windows laptop

This profile prioritizes reliable operation on limited RAM, not the biggest model number. Keep heavy inference sequential. Jarvis now serializes Ollama chat/vision calls with image generation, limits the default context to 4,096 tokens, and unloads Ollama weights before a Diffusers image job. Semantic embeddings are also run sequentially and are unloaded immediately after each request.

## Recommended baseline

| Capability | Model/runtime | Why this profile uses it |
|---|---|---|
| Chat and research synthesis | `qwen3.5:2b` through Ollama | Small shared text model with multilingual support and reasoning/tool-use capabilities. |
| Image understanding | The same `qwen3.5:2b` | Qwen3.5 supports image input, so a second vision model is not required by default. |
| Coding | The same `qwen3.5:2b` | Not as specialized as a dedicated coder, but avoids keeping another large model in RAM. |
| Memory retrieval | `qwen3-embedding:0.6b` through Ollama | A real embedding model improves semantic matching. It is unloaded after each embedding call to limit RAM use, so memory operations can add latency. |
| Speech recognition | Whisper.cpp multilingual **small** model | Better recognition potential than tiny/base at a higher CPU/RAM cost. Start with base if small is too slow. |
| Speech output | Piper English and Telugu **medium** voice assets | Local/offline neural TTS. Model files and their individual licenses must be checked. |
| Image generation | Local Diffusers Stable Diffusion 1.5 model at 512×512 | A practical quality/size baseline for CPU-only use. Image generation is slow on an Intel integrated-graphics laptop and is not guaranteed to fit alongside other processes without closing memory-heavy apps. |

Model references: [Qwen3.5 on Ollama](https://ollama.com/library/qwen3.5), [Qwen3 Embedding on Ollama](https://ollama.com/library/qwen3-embedding), and [Piper voice list and model licences](https://github.com/hawkhai/piper-tts/blob/main/docs/VOICES.md).

**Important:** 8 GB system RAM is a hard constraint. No software setting can make a large model fit into memory it does not have. Close games, browsers with many tabs, and other model workers before image generation. If Windows becomes unstable or pages heavily, reduce the model/context size or disable semantic embeddings.

## Install the baseline models

Run these commands in Windows Terminal after installing Ollama:

```powershell
ollama pull qwen3.5:2b
ollama pull qwen3-embedding:0.6b
ollama list
```

Use the same model tag in all three model settings in the private `.env` file:

```dotenv
BOBAI_OLLAMA_MODEL=qwen3.5:2b
BOBAI_OLLAMA_CODING_MODEL=qwen3.5:2b
BOBAI_OLLAMA_VISION_MODEL=qwen3.5:2b
BOBAI_OLLAMA_EMBEDDING_MODEL=qwen3-embedding:0.6b
BOBAI_OLLAMA_NUM_CTX=4096
BOBAI_OLLAMA_NUM_PREDICT=512
```

If the embedding model's startup cost is too annoying, set `BOBAI_OLLAMA_EMBEDDING_MODEL=disabled`. Jarvis will then use its available lexical fallback and any installed specialist embedding checkpoint instead of loading Qwen3 Embedding. That reduces semantic recall quality, but avoids a second model load on each memory operation.

### Optional quality experiment

Only after the baseline is stable, try `qwen3.5:4b` as the shared chat/vision/coding model. Pull it with `ollama pull qwen3.5:4b`, then change **all three** settings together. Keep the 4,096-token context initially. Revert to 2B if Windows memory use, response latency, or model loading becomes unreliable. Do not keep separate chat, coder, and vision models loaded simultaneously on this laptop.

A dedicated coding model such as `qwen2.5-coder:3b` may improve coding on some tasks, but it is an optional trade-off, not the default profile: switching between different tags can increase model reload time and memory pressure. Compare it only after baseline tests pass.

## Image-generation setup

1. Install the optional Python dependencies in the Python environment selected by `BOBAI_PYTHON`: `python -m pip install -r requirements-image.txt`.
2. Download a Diffusers-compatible Stable Diffusion 1.5 model to a local directory. Read its model card and licence first.
3. Set `BOBAI_IMAGE_MODEL_PATH` to that directory in `.env`.
4. Close other RAM-heavy applications and start with one 512×512 image.
5. Allow the first run extra time for model loading. CPU-only generation may take several minutes or fail under memory pressure. Do not test multiple images or large dimensions until a single image succeeds.

Jarvis will serialize this work against its Ollama inference queue and ask Ollama to unload resident model weights before launching Diffusers. This is deliberate: the next chat request may need to reload its model.

## Voice setup

1. Install/build the native media integration with the repository's documented native build tools and `npm run native:media:build`.
2. Set `BOBAI_WHISPER_MODEL_PATH` to a real local Whisper.cpp multilingual small model file. If it is too slow, use base.
3. Set `BOBAI_PIPER_EN_MODEL_PATH` and `BOBAI_PIPER_EN_CONFIG_PATH` to the English Piper ONNX file and matching JSON.
4. Set `BOBAI_PIPER_TE_MODEL_PATH` and `BOBAI_PIPER_TE_CONFIG_PATH` to the Telugu Piper ONNX file and matching JSON.
5. Set `BOBAI_ESPEAK_DATA_PATH` to the required phoneme data directory.
6. Test the voice status endpoint, English transcription, Telugu transcription, English speech output, Telugu speech output, and playback independently.

Piper voice availability and pronunciation quality vary by voice. Verify that the chosen voice supports the language you need; a filename or environment variable alone does not prove the voice works.

## Research and memory

- For stronger web results, optionally configure `BOBAI_BRAVE_SEARCH_API_KEY`. Without it, Jarvis uses its existing public-search fallback. Search results are untrusted evidence, not truth; verify the returned citations.
- Keep `DATABASE_URL` private and apply the repository's database migrations before testing persistence.
- Test memory with exact recall, paraphrased recall, conflicting facts, duplicate memories, deletion, expiration, and two separate user accounts.
- The embedding model is loaded sequentially and unloaded after use to avoid holding it in RAM alongside chat. This is slower than a permanently resident embedding server but is the safer baseline for an 8 GB machine.

## After code implementation: exact verification sequence

Run from the repository root in PowerShell:

```powershell
git switch main
git pull --ff-only origin main
npm ci
npm test
npm run build
npm run smoke
npm run audit
ollama list
```

Then finish setup in this order:

1. Copy `.env.example` to `.env` only if you do not already have a private `.env`; do not overwrite existing secrets.
2. Set `DATABASE_URL`, verify that it points at the intended database, then run `npm run db:migrate` to apply the repository SQL migrations.
3. Set the Ollama and media model paths listed above. Never commit `.env` or paste its secrets into chat.
4. Start Ollama, then start Jarvis with `npm run ai`.
5. Verify chat, streaming, coding, image understanding, semantic memory, research citations, speech transcription, speech output, and one 512×512 image separately.
6. Check Windows Task Manager during chat, embedding, voice, and image generation. Confirm Ollama model weights are released before image generation and note peak RAM and elapsed time.
7. Reboot and repeat a short smoke pass to ensure no feature depends on a leftover process or previously loaded model.

## Honest definition of done

**Code-side** means the adapters, validation, fallback paths, memory controls, tests, and setup instructions are implemented. **Operationally complete** additionally means the chosen models are downloaded, the database is migrated, the native voice runtime builds, each feature produces a real result on this computer, peak memory is acceptable, and citations/memory isolation pass live checks. The latter cannot be proven by repository CI alone.
