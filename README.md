# Jarvis

**A local-first AI assistant that runs on your own computer.**
Jarvis chats, writes code, checks the weather, reads your files and talks back with a natural British voice. The AI model runs on your machine through [Ollama](https://ollama.com), so your conversations are not sent to an AI company to be answered.

> School project by BobPlayz · Class 8 · 2026

---

## What it can do

| Feature | How it works | Needs internet? |
| --- | --- | --- |
| 💬 **Chat & code** | Streaming answers with formatted text, tables and highlighted code you can copy | No |
| 🧠 **Memory** | Say *"remember that …"* and Jarvis saves it; ordinary messages are never saved by accident | No |
| 🌦️ **Live weather** | Real data from [Open-Meteo](https://open-meteo.com), labelled **Live** or **Cached** with the time it was fetched | Yes |
| 🏏 **Cricket scores** | Live feed from CricketData.org with a free key; otherwise web search, clearly labelled — never invented | Yes |
| 🔎 **Research** | Searches the web, reads the pages and lists the sources it used | Yes |
| 📎 **Files** | PDFs, text, code and images, checked on the server before they are read | No |
| 🗣️ **Voice** | Speak to Jarvis, and hear replies in the *Alan* voice (Piper `en_GB-alan-medium`), generated offline | No |
| 🎨 **Images** | Local image generation with Stable Diffusion, no image API key (slow on a laptop CPU) | No |
| ✅ **Safe tools** | Anything that acts for you shows an approval card first: approve once, or decline | — |
| 🔐 **Accounts** | One-time email code sign-in (no password), sessions stored securely in Postgres | Yes |

There is also a **demo mode** at `/demo` that shows the interface with sample data and never talks to the server.

## Built with

- **Web app:** Next.js 16, React 19, Tailwind CSS 4, three.js (the 3D orrery), Instrument Serif + Schibsted Grotesk
- **API:** Node.js 24, Express 5, TypeScript
- **AI:** Ollama (local, your own PC through the gateway, or Ollama Cloud). Jarvis discovers the available models and picks the best one per request, with automatic fallback
- **Voice:** Piper (text to speech) and faster-whisper (speech to text), both offline
- **Database:** PostgreSQL (Neon works great) with Drizzle ORM
- **Email:** Resend for sign-in codes

## Project layout

```
apps/
  web/        Next.js website and chat interface
  api/        Express API: chat, auth, memory, files, voice, tools
  bobhs/      Background job scheduler
  ollama-gateway/  Secure gateway so the hosted site can use Ollama on your PC
packages/
  db/         Database schema (Drizzle)
drizzle/      SQL migrations
scripts/      Setup, migration and helper scripts
docs/         Guides (setup, security, deployment, models)
model-training/  Experiments for training a small model (optional)
```

## Run it on your laptop (Windows)

Works on an 8 GB RAM laptop. Close heavy apps (games, lots of browser tabs) before starting.

**1. Install the tools**
- [Node.js 24](https://nodejs.org) (LTS)
- [Ollama](https://ollama.com/download)
- [Git](https://git-scm.com)

**2. Get the code**
```powershell
git clone https://github.com/BobPlayz/BobAi.git
cd BobAi
npm ci
```

**3. Download the AI model** (about 3 GB, once)
```powershell
ollama pull qwen3.5:2b
```

**4. Create your settings file**
```powershell
Copy-Item .env.example .env
```
Then open `.env` and fill in:
- `DATABASE_URL`: your Postgres connection string (for example from [Neon](https://neon.tech))
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: for sign-in emails. For local testing only, you can set `BOBAI_DEV_LOG_OTP=true` instead and the code is printed in the terminal.

Never commit `.env`. It holds your secrets.

**5. Set up the database**
```powershell
npm run db:migrate
```

**6. (Optional) Voice and image generation**
```powershell
npm run setup:local-media
```
This downloads Piper, the Alan voice, Whisper and Tiny-SD (needs Python 3.11 and a few GB of disk).

**7. Start Jarvis**
```powershell
npm run ai
```
This runs the tests, then starts the API on <http://localhost:3001> and the website on <http://localhost:3000>.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run ai` | Run tests, then start everything |
| `npm run web` / `npm run api` | Start just the website or just the API |
| `npm test` | Run all automated tests |
| `npm run build` | Production build of every app |
| `npm run lint --workspace=web` | Check the website code style |
| `npm run db:migrate` | Apply database migrations |
| `npm run gateway` | Run the Ollama gateway for the hosted site |
| `npm run icons` | Regenerate the favicon and app icons from `apps/web/brand/jarvis-mark.svg` |

## How it stays safe

- Secrets live only in `.env` (ignored by Git) and in your hosting provider's settings.
- Passwords and session tokens are hashed; sessions use secure, HttpOnly cookies.
- Web pages fetched by Jarvis are checked so it cannot be tricked into reading private network addresses.
- Tools that act on your behalf need your approval every time.
- Uploads are validated and, in production, scanned before they are read.

More detail: [docs/SECURITY.md](docs/SECURITY.md).

## Hosting on Vercel

Vercel hosts the website and the API. Vercel **cannot reach Ollama on your laptop directly**, so Jarvis includes a small, secure **Ollama gateway** (`npm run gateway`) that you run next to Ollama and publish with a free Cloudflare Tunnel. It needs a secret token, only allows Jarvis's own model calls and runs one request at a time. Setup: [docs/OLLAMA_GATEWAY.md](docs/OLLAMA_GATEWAY.md). Deployment settings: [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md).

## Status

Tested end to end against a real Postgres database and Ollama (October 2026): email-code sign-in (wrong and reused codes rejected), sessions and logout, streaming chat, history without duplicates, memory, per-user data isolation, live weather, web research, text uploads, image understanding, Alan voice output, Whisper voice input, and chat through the Ollama gateway. Real email delivery depends on your Resend setup. Generating images on a laptop CPU is slow.

## License

All rights reserved © BobPlayz. Ask before reusing.
