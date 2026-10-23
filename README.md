# Jarvis

**A chill AI assistant powered by [Ollama](https://ollama.com).**
Jarvis chats, helps with code, checks the weather and cricket, researches with real sources, reads your files and talks back in a British voice. It runs on open AI models through Ollama, either on your own computer or on Ollama Cloud, and it picks the best available model for each message by itself.

> School project by BobPlayz · Class 8 · 2026 · Live at <https://jarvis-x-ai-two.vercel.app>

---

## What it can do

| Feature | How it works | Live site | On your PC |
| --- | --- | --- | --- |
| 💬 **Chat & code** | Answers type out live, with tables and code you can copy. Shows which model wrote each answer | ✅ | ✅ |
| 🤖 **Automatic models** | Finds the models your Ollama offers, picks the best one per task (chat, code, reasoning, pictures) and switches if one fails | ✅ | ✅ |
| 🧠 **Memory** | Say *"remember that …"* and Jarvis saves it. Ordinary messages are never saved by accident | ✅ | ✅ |
| 🌦️ **Live weather** | Real data from [Open-Meteo](https://open-meteo.com), labelled **Live** or **Cached** with the time it was checked | ✅ | ✅ |
| 🏏 **Cricket scores** | CricketData.org with a free key; otherwise a web search, clearly labelled. Never invented | ✅ | ✅ |
| 🔎 **Research** | Searches the web, reads the pages and lists its sources | ✅ | ✅ |
| 🖼️ **Pictures** | Describe or ask about an image, using a vision-capable model | ✅ | ✅ |
| 📎 **Files** | PDFs, text and code, checked before they are read | Needs a malware scanner | ✅ |
| 🗣️ **Talk mode** | Hands-free voice chat: Jarvis listens, answers out loud, listens again. ElevenLabs when a key is set, otherwise your browser's voice; Whisper + Piper offline on a PC | ✅ | ✅ |
| 🎨 **Drawing** | Pollinations on the live site (free, no key); Stable Diffusion offline on a PC | ✅ | ✅ |
| 🛠️ **Build a website** | Ask for a calculator, game or quiz: press **Preview** to run it in a locked-down sandbox, or ask for it *"on localhost"* and Jarvis hosts it on your PC | Preview | ✅ |
| 🌍 **Your language** | Pick the reply language (24 to choose from) and Jarvis sticks to it | ✅ | ✅ |
| 👋 **Texts like you** | Matches your generation's texting style and learns how you type (you can turn it off) | ✅ | ✅ |
| ✅ **Asks first** | Anything that acts for you shows an approval card first | ✅ | ✅ |
| 🔐 **Sign in** | 6-digit email code, no passwords. Sessions stored securely in Postgres | ✅ | ✅ |

There is also a **demo** at `/demo` that shows the interface with sample data and never talks to the server.

## Built with

- **Website:** Next.js 16, React 19, Tailwind CSS 4, three.js (the 3D orrery), Instrument Serif + Schibsted Grotesk
- **API:** Node.js 24, Express 5, TypeScript
- **AI:** Ollama only: local, your own PC through the Jarvis gateway, or Ollama Cloud ([how models are picked](docs/MODEL_ROUTING.md))
- **Voice:** Piper (text to speech) and faster-whisper (speech to text), both offline
- **Database:** PostgreSQL (Neon) with Drizzle ORM
- **Email:** Gmail SMTP with an app password (free, no domain needed) or Resend

## Project layout

```
apps/
  web/             Next.js website and chat
  api/             Express API: chat, model routing, auth, memory, files, voice, tools
  ollama-gateway/  Secure gateway so the hosted site can use Ollama on your PC
packages/
  db/              Database schema (Drizzle)
drizzle/           SQL migrations
scripts/           Setup, migration, end-to-end test and helper scripts
docs/              Guides (setup, security, deployment, models)
```

## Run it on your laptop (Windows)

Works on an 8 GB RAM laptop. Close heavy apps before starting.

**1. Install the tools:** [Node.js 24](https://nodejs.org), [Ollama](https://ollama.com/download), [Git](https://git-scm.com)

**2. Get the code**
```powershell
git clone https://github.com/BobPlayz/BobAi.git
cd BobAi
npm ci
```

**3. Download at least one AI model** (about 3 GB, once). Jarvis finds and uses whatever you install.
```powershell
ollama pull qwen3.5:2b
```

**4. Create your settings file**
```powershell
Copy-Item .env.example .env
```
Then fill in `DATABASE_URL` (your Postgres connection string, e.g. from [Neon](https://neon.tech)) and an email sender (see [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md#login-codes-by-email-without-owning-a-domain)). For local testing only, `BOBAI_DEV_LOG_OTP=true` prints the code in the terminal instead. Never commit `.env`.

**5. Set up the database**
```powershell
npm run db:migrate
```

**6. (Optional) Voice and drawing**
```powershell
npm run setup:local-media
```
Downloads Piper, the Alan voice, Whisper and Tiny-SD (needs Python 3.11 and a few GB of disk).

**7. Start Jarvis**
```powershell
npm run ai
```
Runs the tests, then starts the API on <http://localhost:3001> and the website on <http://localhost:3000>.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run ai` | Run tests, then start everything |
| `npm run web` / `npm run api` | Start just the website or just the API |
| `npm test` | Run all automated tests |
| `npm run e2e` | Full end-to-end check against a local API (sign-in, chat, history, memory, weather, uploads, voice) |
| `npm run build` | Production build of every app |
| `npm run lint --workspace=apps/web` | Check the website code |
| `npm run db:migrate` | Apply database migrations |
| `npm run gateway` | Run the Ollama gateway for the hosted site |
| `npm run icons` | Regenerate the favicon and app icons |

## How it stays safe

- Secrets live only in `.env` (ignored by Git) and in your hosting settings, never in the browser.
- Login codes and session tokens are stored hashed; sessions use Secure, HttpOnly cookies; cross-site requests are blocked.
- Web pages Jarvis fetches cannot point it at private network addresses.
- Tools that act for you need your approval every time.
- Uploads are validated and, on the live site, must pass a malware scanner.

More detail: [docs/SECURITY.md](docs/SECURITY.md).

## Hosting on Vercel

Vercel hosts the website and the API. For the AI, either use **Ollama Cloud** (set `BOBAI_OLLAMA_BASE_URL=https://ollama.com` and your key) or run Ollama on your PC behind the secure **Jarvis gateway** with a free Cloudflare Tunnel ([docs/OLLAMA_GATEWAY.md](docs/OLLAMA_GATEWAY.md)). Settings and checks: [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md). `GET /api/ready` shows whether the database, email and models are working.

## Status (October 2026)

- **Tested automatically:** type checks, lint (0 warnings), builds and 5 test suites (110+ API tests, including model routing and fallback).
- **Tested end to end on a laptop:** email-code sign-in (wrong and reused codes rejected), sessions and logout, streaming chat through automatic model routing, history after reload in the right order, memory, per-user privacy, live weather, web research, uploads, image understanding, Alan voice, Whisper voice input, and Gmail-style SMTP delivery against a local test mail server.
- **Live site:** database, migrations, production security settings, Ollama Cloud key and model discovery all report ready. A full live chat and real Gmail delivery have to be checked by signing in.

## License

All rights reserved © BobPlayz. Ask before reusing.
