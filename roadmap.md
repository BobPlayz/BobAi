🧠 bobai — 10 phase roadmap

last updated: 2026-08-24

recent implementation log

- legacy is now the default experience for new and existing users without a saved theme
- theme provider now supports legacy, futuristic, anime, glass, light, and dark modes
- accent color customization persists locally and updates the shared UI token
- futuristic robot intro remains the available 3d intro and now cancels cleanly on theme changes
- onboarding is routed after login/signup and persists its answers locally
- React Bits-inspired Stepper, BorderGlow, GooeyNav, PillNav, and MagicBento integrations are active
- removed five verified unreferenced UI components; legacy components remain because legacy is the default
- copyright-free recognizable versions of 30 popular anime franchise characters are not available as a safe bundle
- anime 3d character pack remains blocked until original CC0 assets or explicit redistribution licenses are acquired
- natural-language coding-task detection now routes qualifying chat requests to the configured coding-agent bridge without slash commands
- normal Ollama chat remains the fallback for non-coding requests
- saved memory is now included in normal and streaming Ollama chat context
- natural-language memory requests are now extracted and persisted by chat
- streaming is mounted at `/stream`, image generation targets `/images/generate`, and PDF extraction uses the installed `pdf-parse` v2 API

phase 1 — foundation & project architecture

~85% done

 monorepo structure
 api project
 next.js web app
 typescript setup
 basic api communication
 postgres/drizzle/pgvector groundwork
 final production architecture
 complete shared state architecture
phase 2 — cinematic neural ui

~75% done

 neural shell
 sidebar
 topbar
 composer
 theme provider
 four theme identifiers
 glass/neural visual direction
 robot/scene prototype
 final reference-accurate proportions
 final glass/depth/lighting
 complete theme visuals
 every visible control functional

the shared theme foundation, selectable themes, persistent accent customization, and intro lifecycle are implemented. final reference-accurate styling and licensed anime assets remain.

phase 3 — chat + global app state

~45% done

 chat page exists
 composer exists
 basic chat/api flow existed
 conversation-management callbacks exist
 centralized global state
 active conversation state
 reliable new chat/search/select/pin/rename/delete
 verified autoscroll
 complete chat persistence
 natural-language intent routing for coding requests

global state and the actual connected sidebar/topbar flow are explicitly listed as next work.

phase 4 — library, settings & personalization

~25% done

 fully functional library
 file management
 settings interface
 model settings
 personality settings
 sfw personality cards
 personality actually changes chat behavior
 persistent preferences
 theme selector with six modes
 persistent accent customization

the interfaces/components were planned, but functionality wasn't confirmed.

phase 5 — memory + files

~15% done

 conversation memory
 long-term memory
 semantic/vector memory
 file uploads
 file analysis
 document understanding
 memory retrieval
 memory controls/privacy
 memory retrieval into chat context
 natural-language memory writes

this is basically future work right now, not something i'm gonna bullshit you into calling 50% because we talked about it 💀

phase 6 — models + ai engine

~30% done

 basic model/provider groundwork
 Ollama experimentation
 local model configuration in coding-agent subsystem
 proper provider abstraction
 reliable model selection
 cloud/local fallback
 streaming
 structured generation
 production reliability
 configurable Ollama chat model
 verified API TypeScript build

the coding-agent side specifically still has Ollama EOF/timeouts and unreliable structured output.

phase 7 — tools + web + multimodal

~5% done

 web search
 browser/tool execution
 image generation
 vision
 voice input
 voice output
 tool permissions
 tool orchestration

emma/vision is only defined/configured conceptually; actual implementation wasn't confirmed.

phase 8 — autonomous agents / coding agents

~50% done architecturally, ~25% reliable

 alex organiser
 ben coder
 ryan reviewer
 agent interfaces
 conversation logging
 filesystem actions
 workspace inspection
 orchestration loop
 retry infrastructure
 checkpoint/rollback hooks
 reliable planning
 reliable coding
 reliable reviewing
 genuine agent-to-agent communication
 emma vision agent
 zero-action success protection
 production validation
 integrate into BobAI
 explicit natural-language handoff from BobAI chat

the architecture exists, but actual autonomous execution was not demonstrated reliably.

phase 9 — complete product integration

~10% done

 connect all core systems
 chat ↔ memory
 chat ↔ files
 chat ↔ tools
 chat ↔ models
 chat ↔ agents (explicit coding-task handoff is now wired)
 bobai decides when to invoke coding agents
 unified user-facing experience
 permissions/security
 end-to-end workflows

the initial natural-language coding-task handoff is wired, but permissions, user-visible run state, cancellation, audit history, and reliable end-to-end agent execution remain unfinished.

phase 10 — polish, testing & production

~0–5% done

 full end-to-end testing
 performance optimization
 error handling
 security hardening
 production database setup
 deployment
 monitoring
 mobile/desktop clients
 api for external clients
 final ui polish
 production validation

 no final production hosting configuration was established, and the handoff explicitly says production validation is still incomplete.

theme and asset decisions

- default: legacy, intentionally plain and low-distraction
- optional: futuristic/neural with the existing animated robot scene
- optional: anime theme shell is ready, but its 3d character requires an original or explicitly redistributable asset
- optional: glass, light, and dark themes use the shared token system
- planned: acquire or commission 30 anime-style original characters with rights for web embedding, modification, and redistribution as part of BobAI
- do not download or bundle fan-made models of Naruto, Goku, Luffy, or other recognizable franchise characters without explicit rights

📊 overall status rn

roughly, by feature completion rather than lines of code:

phase 1: 85%
phase 2: 75%
phase 3: 45%
phase 4: 25%
phase 5: 20%
phase 6: 30%
phase 7: 5%
phase 8: 50% architecture / ~25% reliability
phase 9: 10%
phase 10: ~5%

so i'd call bobai overall around ~25–30% complete right now.

