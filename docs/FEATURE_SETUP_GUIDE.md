# Jarvis feature setup

How to turn on each feature. Never commit `.env` or paste credentials into chat.

## 1. Install and start

1. Install Node.js 24+, Git and [Ollama](https://ollama.com/download).
2. `git clone https://github.com/BobPlayz/BobAi.git`, then `npm ci`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` (Neon) and an email sender (section 6).
4. Pull at least one model, e.g. `ollama pull qwen3.5:2b`. Jarvis discovers installed models by itself.
5. `npm run db:migrate`, then `npm run ai` (runs the tests, then starts the API on :3001 and the website on :3000).

## 2. Chat, coding and image understanding

`BOBAI_OLLAMA_BASE_URL=http://127.0.0.1:11434` for local Ollama, or `https://ollama.com` plus `BOBAI_OLLAMA_API_KEY` for Ollama Cloud. No model name is needed: each request goes to the best available model for the task, with fallback ([MODEL_ROUTING.md](MODEL_ROUTING.md)). Optional: `BOBAI_OLLAMA_MODEL` (a preference), `BOBAI_OLLAMA_NUM_CTX` (default 4096), `BOBAI_OLLAMA_NUM_PREDICT` (default 1536). Semantic memory search is off by default; set `BOBAI_OLLAMA_EMBEDDING_MODEL=qwen3-embedding:0.6b` and pull it to turn it on.

Check: `GET /api/ready` shows `modelReachable: true` and `modelPicks`.

## 3. Live weather, cricket and research

- Weather: Open-Meteo, no key.
- Cricket: optional `BOBAI_CRICKET_API_KEY` (CricketData.org free key) for a live feed; otherwise web search results, labelled as such.
- Research: DuckDuckGo by default, or `BOBAI_BRAVE_SEARCH_API_KEY` for Brave Search. Answers list the sources they used.

## 4. Pictures

On the hosted site pictures come from **Pollinations** (free, no key, private requests; small watermark). Editing an existing picture needs the local generator. Without a key Pollinations allows about one picture every 45 seconds per server, so Jarvis waits briefly when it is busy; a free `POLLINATIONS_API_KEY` from enter.pollinations.ai lifts that. Set `BOBAI_IMAGE_PROVIDER=off` to turn pictures off.

### Local image generation (PC)

`npm run setup:image-generation` (Tiny-SD) or `npm run setup:image-generation -- -Profile quality` (DreamShaper 8, slower and bigger). Then `npm run test:image-generation` saves a test PNG. Uses a local Diffusers pipeline (no ComfyUI, no image API); a 512×512 image takes about a minute and a half on a laptop CPU. Other Ollama models are unloaded first to free memory.

## 5. Voice

**Talk mode** (the *Talk* button in the chat) is a hands-free voice conversation: Jarvis listens, answers when you pause, says the answer out loud and listens again. Everything also lands in the chat.

| | Hearing you | Talking back |
|---|---|---|
| `ELEVENLABS_API_KEY` set in Vercel | ElevenLabs Scribe | ElevenLabs (British "George" by default, `ELEVENLABS_VOICE_ID` to change) |
| No key | the browser's speech recognition (Chrome, Edge, Safari) | the browser's built-in voice |
| On a PC with local voice set up | Whisper.cpp | Piper |

Free-plan caps (change in env): `BOBAI_LIMIT_SPEECH_CHARACTERS_PER_MONTH` (default 15,000 characters read aloud) and `BOBAI_LIMIT_SPEECH_INPUT_SECONDS_PER_MONTH` (default 3,600 seconds heard). When a cap is hit, talk mode switches to the browser's voice. Replies in talk mode are kept short and speakable, in the reply language picked in Settings.

### Local voice (PC)

`npm run setup:local-media` downloads Piper with the *Alan* voice and faster-whisper. Optional Telugu voice: `BOBAI_PIPER_TE_MODEL_PATH` / `BOBAI_PIPER_TE_CONFIG_PATH`. `npm run setup:glasses-voice` restores the Alan/Venkatesh voice files. Check `GET /voice/status`.

## 6. Email codes

- **Gmail SMTP (free, no domain):** turn on 2-Step Verification, create an app password, then set `BOBAI_EMAIL_PROVIDER=smtp`, `BOBAI_SMTP_HOST=smtp.gmail.com`, `BOBAI_SMTP_PORT=465`, `BOBAI_SMTP_USER`, `BOBAI_SMTP_PASSWORD`, `BOBAI_SMTP_FROM=Jarvis <you@gmail.com>`.
- **Resend:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` with a domain you verified in Resend.
- Local only: `BOBAI_DEV_LOG_OTP=true` prints codes in the terminal.
- **Guest mode:** "Just try it, no email needed" on the login page makes a private account with no email (on the reserved `guest.jarvis.invalid` domain, so nothing is ever emailed). Capped at 10 new guests per network per day; `BOBAI_GUEST_ACCESS=false` turns it off.
- **Sign everyone out:** set `BOBAI_SESSIONS_VALID_AFTER` in Vercel to the current time (for example `2026-10-24T00:00:00Z`) and redeploy. Every login from before then stops working, so everyone signs in again. Accounts, chats and memories are kept.
- Code requests are capped per IP and per email address each day (see the limits table in [MODEL_ROUTING.md](MODEL_ROUTING.md)).

Details: [QUICK_START_AUTH.md](QUICK_START_AUTH.md).

## 7. File uploads

Work locally without extra setup. In production they need a malware scanner at `BOBAI_MALWARE_SCANNER_URL`; without one, uploads are refused with a clear message.

## 8. Checks

```
npm test
npm run e2e        (against a running local API; prints PASS/FAIL per feature)
npm run build
npm run audit
npm run repo:preflight
```

The automated tests do not prove Gmail delivery or a specific model's quality; try those directly after setup.
