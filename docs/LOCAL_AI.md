# Running the AI on your own computer

Jarvis uses Ollama for all AI. On your own computer everything except web research, weather, cricket, the database and email works without internet.

## Chat, coding and image understanding

1. Install [Ollama](https://ollama.com/download).
2. Pull at least one model, e.g. `ollama pull qwen3.5:2b` (chat, code and pictures in one, fits 8 GB RAM). Add more if you have room; Jarvis uses them all.
3. In `.env`: `BOBAI_OLLAMA_BASE_URL=http://127.0.0.1:11434`. No model name is needed.

Jarvis lists the installed models, reads what each can do, and picks one per request: a vision model for images, a stronger thinking model for hard questions, a fast one for quick chats. Other local models are unloaded before switching so only one sits in memory. Details and optional settings: [MODEL_ROUTING.md](MODEL_ROUTING.md).

To use your PC's Ollama from the hosted website, see [OLLAMA_GATEWAY.md](OLLAMA_GATEWAY.md). Never expose Ollama itself to the internet.

## Image generation

Jarvis calls a local Python Diffusers pipeline directly (no ComfyUI, no image API).

- `npm run setup:local-media` downloads Tiny-SD and the Python packages, or set `BOBAI_IMAGE_MODEL_PATH` to any Diffusers model folder and `BOBAI_PYTHON` to your Python.
- Models are never downloaded at request time. 512×512 images on a laptop CPU take about a minute and a half.
- Reference-image editing uses `AutoPipelineForImage2Image` when the model supports it. Video generation is not available.

## Voice

- Speaking: Piper with the English *Alan* voice (`en_GB-alan-medium`); a Telugu voice can be added with `BOBAI_PIPER_TE_MODEL_PATH`.
- Listening: faster-whisper (`BOBAI_WHISPER_PYTHON_MODEL_PATH`) or whisper.cpp (`BOBAI_WHISPER_MODEL_PATH`).
- `npm run setup:local-media` downloads Piper, the Alan voice and Whisper. The microphone only listens when you press the button.

## Running on a small board (Raspberry Pi 5 or similar)

Any 64-bit Linux board with **8 GB of RAM** works (Raspberry Pi 5 8 GB, Orange Pi 5, Jetson Orin Nano). Chat and voice
run on the board; pictures are too slow there, so they come from Pollinations. Use Raspberry Pi OS (64-bit) or Ubuntu.

```bash
sudo apt update && sudo apt install -y git python3-venv curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs   # Node 22
curl -fsSL https://ollama.com/install.sh | sh && ollama pull qwen3.5:2b                           # the AI model
git clone https://github.com/BobPlayz/BobAi && cd BobAi && npm ci

mkdir -p ~/jarvis-voice && cd ~/jarvis-voice                                                       # voice files
curl -LO https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_aarch64.tar.gz && tar xzf piper_linux_aarch64.tar.gz
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json
python3 -m venv venv && venv/bin/pip install faster-whisper
venv/bin/python -c "from faster_whisper import download_model; download_model('base.en', output_dir='whisper-base')"
```

Then copy `.env.example` to `.env` in the `BobAi` folder, fill in `DATABASE_URL` and the email settings, and add:

```bash
BOBAI_OLLAMA_BASE_URL=http://127.0.0.1:11434
BOBAI_PIPER_COMMAND=/home/<you>/jarvis-voice/piper/piper
BOBAI_PIPER_EN_MODEL_PATH=/home/<you>/jarvis-voice/en_GB-alan-medium.onnx
BOBAI_PIPER_EN_CONFIG_PATH=/home/<you>/jarvis-voice/en_GB-alan-medium.onnx.json
BOBAI_VOICE_PYTHON=/home/<you>/jarvis-voice/venv/bin/python
BOBAI_WHISPER_PYTHON_MODEL_PATH=/home/<you>/jarvis-voice/whisper-base
BOBAI_IMAGE_PROVIDER=pollinations
# so phones and laptops on your Wi-Fi can use it (replace with the board's IP, e.g. 192.168.1.50):
NEXT_PUBLIC_API_URL=http://<board-ip>:3001
CORS_ORIGIN=http://<board-ip>:3000,http://localhost:3000
```

Run `npm run db:migrate` once, then `npm run ai` and open `http://<board-ip>:3000` from any device on the same Wi-Fi.
Websites Jarvis builds "on localhost" are served by the board at `http://<board-ip>:3001/sites/<name>/`.

## Web research

Jarvis builds search queries, fetches results (Brave Search with `BOBAI_BRAVE_SEARCH_API_KEY`, otherwise DuckDuckGo), reads the pages, ranks sources and has the model write an answer that cites them. Web pages are treated as untrusted data and cannot steer Jarvis.

## Security

- Keep secrets in `.env` only. Never expose Ollama or the coding-agent bridge directly to the internet.
- Treat web pages, uploads, model output and tool results as untrusted.
- Tools that act for you always ask first.
