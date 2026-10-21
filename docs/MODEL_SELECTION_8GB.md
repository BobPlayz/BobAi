# Jarvis model profile for an 8 GB Windows laptop

This profile prioritizes reliable operation on limited RAM, not the biggest model number. Keep heavy inference sequential. Jarvis now serializes Ollama chat/vision calls with image generation, limits the default context to 3,072 tokens, and unloads Ollama weights before a Diffusers image job. Semantic embeddings are also run sequentially and are unloaded immediately after each request.

## Recommended baseline

| Capability | Model/runtime | Why this profile uses it |
|---|---|---|
| Chat and research synthesis | `qwen3.5:4b` through Ollama | Stronger shared text-and-image model with multilingual support and reasoning/tool-use capabilities. |
| Image understanding | The same `qwen3.5:4b` | Qwen3.5 supports image input, so a second vision model is not required by default. |
| Coding | The same `qwen3.5:4b` through Ollama | One model keeps setup simple and avoids extra model downloads. A dedicated coding model can be added later if desired. |
| Memory retrieval | Built-in non-embedding fallback by default | Avoids a second model download. Semantic recall may be less accurate; an embedding model remains an optional upgrade. |
| Speech recognition | Whisper.cpp multilingual **small** model | Better recognition potential than tiny/base at a higher CPU/RAM cost. Start with base if small is too slow. |
| Speech output | Piper English and Telugu **medium** voice assets | Local/offline neural TTS. Model files and their individual licenses must be checked. |
| Image generation | Local Diffusers Stable Diffusion 1.5 model at 512×512 | A practical quality/size baseline for CPU-only use. Image generation is slow on an Intel integrated-graphics laptop and is not guaranteed to fit alongside other processes without closing memory-heavy apps. |

Model references: [Qwen3.5 on Ollama](https://ollama.com/library/qwen3.5), [Qwen3 Embedding on Ollama](https://ollama.com/library/qwen3-embedding), and [Piper voice list and model licences](https://github.com/hawkhai/piper-tts/blob/main/docs/VOICES.md).

**Important:** 8 GB system RAM is a hard constraint. No software setting can make a large model fit into memory it does not have. Close games, browsers with many tabs, and other model workers before image generation. If Windows becomes unstable or pages heavily, reduce the model/context size or disable semantic embeddings.

## Install the baseline models

Run these commands in Windows Terminal after installing Ollama:

```powershell
ollama pull qwen3.5:4b
ollama list
```

Use the following model settings in the private `.env` file. `BOBAI_OLLAMA_THINK=false` disables Qwen's explicit reasoning mode by default, so the model returns its answer directly instead of emitting a long visible thinking trace. Set it to `true` only when you deliberately want reasoning mode. This reduces reasoning-token overhead but cannot make CPU inference literally instant. Jarvis switches models sequentially and unloads other resident Ollama weights before a different model is used:

```dotenv
BOBAI_OLLAMA_MODEL=qwen3.5:4b
BOBAI_OLLAMA_EMBEDDING_MODEL=disabled
BOBAI_OLLAMA_NUM_CTX=3072
BOBAI_OLLAMA_NUM_PREDICT=256
BOBAI_OLLAMA_THINK=false
```

The default sets `BOBAI_OLLAMA_EMBEDDING_MODEL=disabled` to honor the one-model setup. Jarvis uses its available lexical fallback and any already-installed specialist embedding checkpoint instead of loading a second Ollama model. This reduces semantic recall quality, but avoids additional model downloads and model switching.

### If the 4B model is too heavy

Change `BOBAI_OLLAMA_MODEL` and `BOBAI_OLLAMA_VISION_MODEL` to `qwen3.5:2b`, then pull that tag with `ollama pull qwen3.5:2b`. Only add specialist coder or embedding models later if you decide the quality gain is worth the extra downloads and RAM pressure. Do not increase context length until the baseline has passed memory tests.

## Image-generation setup

1. Copy `.env.example` to `.env` and install Python 3.11 x64.
2. Run `npm run setup:image-generation` to install CPU-only PyTorch and Diffusers, download the lightweight Tiny-SD model, and configure the local model path.
3. Run `npm run test:image-generation` and confirm `storage/image-generation-smoke.png` is created.
4. Close other RAM-heavy applications and start with one 512×512 image.
5. Allow the first run extra time for model loading. CPU-only generation may take several minutes or fail under memory pressure. Do not test multiple images or large dimensions until a single image succeeds. For higher quality, use `npm run setup:image-generation -- -Profile quality` only after the lightweight profile works.

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
3. If the database already contains saved memories, run `npm run memory:reindex` once to rebuild semantic vectors with the selected embedding model. This can take time and should be run while Jarvis is not serving user requests.
3. Set the Ollama and media model paths listed above. Never commit `.env` or paste its secrets into chat.
4. Start Ollama, then start Jarvis with `npm run ai`.
5. Verify chat, streaming, coding, image understanding, semantic memory, research citations, speech transcription, speech output, and one 512×512 image separately.
6. Check Windows Task Manager during chat, embedding, voice, and image generation. Confirm Ollama model weights are released before image generation and note peak RAM and elapsed time.
7. Reboot and repeat a short smoke pass to ensure no feature depends on a leftover process or previously loaded model.

## Honest definition of done

**Code-side** means the adapters, validation, fallback paths, memory controls, tests, and setup instructions are implemented. **Operationally complete** additionally means the chosen models are downloaded, the database is migrated, the native voice runtime builds, each feature produces a real result on this computer, peak memory is acceptable, and citations/memory isolation pass live checks. The latter cannot be proven by repository CI alone.
