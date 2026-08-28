🧠 bobai — 10 phase roadmap

last updated: 2026-08-28

recent implementation log

- legacy remains the default experience for users without a saved theme
- theme provider supports legacy, futuristic, anime, glass, light, and dark modes
- accent color customization persists locally
- futuristic robot intro remains the available 3d intro and cancels cleanly on theme changes
- onboarding is routed after login/signup and persists locally
- React Bits-inspired UI integrations are active
- natural-language coding-task detection routes qualifying chat requests to the configured coding-agent bridge
- normal Ollama chat remains the fallback for non-coding requests
- memory extraction and persistence are wired into chat
- streaming is mounted at `/stream`, image generation targets `/images/generate`, and PDF extraction uses the installed `pdf-parse` v2 API
- local model registry now defines qwen 3b, qwen 7b, coder 1.5b, and coder latest with capability metadata
- Ollama provider now performs health checks, installed-model discovery, availability checks, request timeouts, and provider health tracking
- centralized model routing is wired into normal and streaming chat with capability-safe fallback selection
- Alex, Ben, and Ryan model routing is explicit: Alex → qwen 3b, Ben → coder latest, Ryan → qwen 3b
- vision remains architecture-ready but is not reported as installed without a configured vision model
- coding orchestration provides Alex → Ben → Ryan planning/coding/review flow with internal messages, task status, and review retries
- `/model-agents/models`, `/model-agents/agents`, and orchestration endpoints expose the configured model/agent architecture behind agent authentication
- `.env.example` and `apps/api/.env.example` document local Ollama/model configuration without real secrets
- `/ready` now reports real Ollama readiness and the registered models detected on the machine

phase 1 — foundation & project architecture

~90% done

 monorepo structure
 api project
 next.js web app
 typescript setup
 basic api communication
 postgres/drizzle/pgvector groundwork
 production architecture foundation
 shared state groundwork
 security integration tests

remaining: complete end-to-end production state architecture and deployment setup

phase 2 — cinematic neural ui

~75% done

 neural shell
 sidebar
 topbar
 composer
 theme provider
 glass/neural visual direction
 robot/scene prototype
 final reference-accurate proportions
 final glass/depth/lighting
 complete theme visuals
 every visible control functional

shared theme foundation and selectable themes are implemented. final reference-accurate styling and licensed anime assets remain.

phase 3 — chat + global app state

~50% done

 chat page
 composer
 connected chat/api flow
 conversation-management callbacks
 active conversation state
 new chat/search/select/pin/rename/delete
 natural-language coding intent routing
 model selection hook in chat API
 streaming model routing

remaining: full server-backed conversation persistence, verified autoscroll, and complete global state integration

phase 4 — library, settings & personalization

~25% done

 library interface
 file management groundwork
 settings interface
 model settings groundwork
 personality settings
 theme selector
 persistent accent customization

remaining: confirm and wire every interface end-to-end

phase 5 — memory + files

~20% done

 conversation memory groundwork
 long-term memory groundwork
 semantic/vector schema
 file uploads
 file analysis groundwork
 memory retrieval service groundwork
 natural-language memory writes

remaining: robust retrieval, embeddings, controls/privacy, and complete file/document pipeline

phase 6 — models + ai engine

~55% done

 model registry
 capability metadata
 Ollama provider
 connection/health check
 installed-model discovery
 model availability
 centralized model selection
 capability-safe fallback
 configurable default/fallback models
 streaming
 provider health tracking

remaining: cloud providers, embeddings, structured generation, production reliability, and laptop verification of all local models

phase 7 — tools + web + multimodal

~5% done

 web search groundwork
 image generation
 vision architecture
 voice groundwork
 tool permissions groundwork

vision is intentionally not marked installed without a real configured vision model.

phase 8 — autonomous agents / coding agents

~55% done architecturally, laptop reliability still unverified

 alex planner
 ben coder
 ryan reviewer
 agent interfaces
 task/status tracking
 internal agent messages
 Alex → Ben → Ryan orchestration
 review loop
 retry infrastructure
 coding-agent bridge
 workspace inspection architecture

remaining: real filesystem execution, checkpoints/rollback, reliable structured output, and end-to-end laptop execution

phase 9 — complete product integration

~20% done

 chat ↔ models
 chat ↔ agents
 natural-language coding handoff
 model/agent inspection endpoints
 readiness reporting

remaining: chat ↔ memory/files/tools, user-visible agent run state, cancellation, audit history, permissions, and complete end-to-end workflows

phase 10 — polish, testing & production

~5% done

 security integration tests
 build validation
 production config validation

remaining: local runtime pass, all model verification, Neon/database configuration, real agent execution, full end-to-end testing, performance, deployment, monitoring, mobile/desktop clients, and final UI polish

current local verification sequence

1. pull the latest main
2. install dependencies
3. configure the local `.env`
4. verify Ollama and all four registered models
5. configure Neon/PostgreSQL
6. configure the coding-agent workspace/key locally
7. run the agents against real files
8. run build
9. run tests
10. run the complete local runtime pass

