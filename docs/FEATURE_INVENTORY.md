# Jarvis feature inventory

**Updated:** 2026-10-23. "Verified" means exercised for real (laptop end-to-end run or live site), not just present in the code.

## Website pages

| Route | Purpose | Status |
| --- | --- | --- |
| `/` | Landing page with the 3D orrery | Verified on desktop and phone |
| `/login` | Name + email, then 6-digit code | Verified locally; live needs a real inbox |
| `/signup`, `/verify-otp` | Old links; redirect to `/login` | Verified |
| `/onboarding` | Name, use, tone, interests | Verified on phone |
| `/chat` | Chat, history sidebar (drawer on phones) | Verified locally |
| `/settings` | Personalization, privacy, memory, about | Verified on phone |
| `/demo` | Sample conversation, no server | Verified |
| `/about`, `/faq`, `/contact`, `/privacy`, `/terms`, 404 | Info pages | Verified; legal text still needs adult review |

## Features

| Feature | Main code | Status |
| --- | --- | --- |
| Model routing and fallback | `services/modelInventory.ts`, `modelHealth.ts`, `modelRouter.ts`, `ollamaProvider.ts` | Verified locally (real Ollama) and with tests; live discovery verified; live chat pending |
| Streaming chat and history | `routes/stream.ts`, `store/conversationDb.ts`, `web/hooks/useChat.ts` | Verified locally: no duplicates, correct order, loads after reload, partial text kept on failure |
| Email-code sign-in | `routes/auth.ts`, `services/otp.ts`, `otpDelivery.ts`, `email.ts` | Verified locally incl. SMTP and Resend→SMTP fallback; real Gmail pending |
| Memory | `routes/memory.ts`, `store/memoryDb.ts` | Verified locally: explicit "remember that" only, per-user, saved in history |
| Live weather | `services/liveData.ts` (Open-Meteo) | Verified locally |
| Cricket | `services/liveData.ts` (CricketData.org key or labelled web search) | Web-search path verified locally |
| Web research | `services/research.ts`, `deepResearch.ts` | Verified locally (sources returned) |
| Image understanding | `services/vision.ts` → `routeVision` | Verified locally |
| File uploads | `routes/files.ts`, `documentIndexer.ts`, `malwareScanner.ts` | Verified locally; live needs a malware scanner |
| Tools with approval | `toolRegistry.ts`, `toolLoop.ts`, `toolDecision.ts` | Tested; approval card shown in the demo |
| Voice (Alan, Whisper) | `routes/voice.ts`, `bobVoice.ts`, `whisperCpp.ts` | Verified on a PC; not available on Vercel |
| Image generation | `flux.ts`, `scripts/local_image_generation.py` | Verified on a PC (Tiny-SD); not available on Vercel |
| Account export/deletion | `routes/account.ts`, `accountPurge.ts` | Present; not exercised end to end |
| Ollama gateway | `apps/ollama-gateway` | Verified with real Ollama and tests |

## API without screens yet

These have API routes but no page in the website yet: reminders, projects, saved prompts, deep research, study packs, global search, conversation branching, the coding-agent bridge. They are reachable through the API only.

## API route groups

`account`, `admin`, `agentOffice`, `agents`, `auth`, `automation`, `capabilities`, `chat`, `collaboration`, `conversations`, `deepResearch`, `ffmpeg`, `files`, `health`, `images`, `mcp`, `memory`, `messages`, `model`, `modelAgents`, `music`, `notifications`, `oauth`, `projects`, `prompts`, `reminders`, `research`, `researchBriefs`, `search`, `settings`, `skills`, `stream`, `study`, `tools`, `vision`, `voice`, `webhooks`. Everything except `auth`, `account` and health requires a session.

## Database

Users, sessions, email codes, conversations, messages, settings, memories (+ history, optional embeddings), workspaces, projects, uploads and document chunks, tool approvals/logs, agent tasks/artifacts, research sessions/briefs, usage, API keys, OAuth/MFA state, notifications, reminders, workflows, webhooks, rate-limit buckets. Schema: `packages/db/src/schema/`; migrations: `drizzle/`.
