# BobAI roadmap

## Phase 1 — Basic foundation
- [x] Monorepo, API, web, database package, TypeScript, Node.js, Express, Next.js, PostgreSQL, Drizzle, pgvector groundwork, environment templates, and launcher
- [x] Authentication, account recovery, MFA, CSRF, secure cookies, rate limits, audit logging, migration locking, idempotency, deletion/export, and collaboration controls
- [x] Durable chat, revisions, search, projects, scoped memory, file processing/sharing, research, automation, agents, MCP, media abstractions, and sandbox policy

## Phase 2 — Local-first AI core
- [x] Native Bob model gateway with no Ollama dependency in the chat path
- [x] Bob-0.2-native tokenizer, configurable decoder-only transformer, direct Node inference, sampling, portable model format, and model status
- [x] CPU/CUDA training pipeline with dataset preparation, validation/test splits, resumable checkpoints, best-checkpoint export, gradient accumulation, cosine scheduling, architecture validation, evaluation, and explicit dependencies
- [x] Local research and deterministic pre-training embeddings without cloud AI credentials

## Phase 3 — Specialist model family
- [x] From-scratch training kits for Vector, Vanta, Echo, Flux, and reranking
- [x] Specialist dataset contracts and preparation for text, paired text, retrieval, images, ASR, TTS, and image generation
- [x] Specialist checkpoint serving, lazy loading, authentication, bounded requests/responses, lifecycle shutdown, and artifact existence checks
- [x] Vector, Vanta, Echo, and Flux execution adapters with runtime leasing and safe pre-training behavior
- [x] Echo PCM16 WAV ASR/TTS boundaries and CTC token handling

## Phase 4 — Smart runtime and security
- [x] Internal model runtime registry with resource-aware loading, idle eviction, request leasing, and task planning
- [x] Hidden Bob Core with admin-only runtime inspection and no normal-user scheduler exposure
- [x] Automatic leasing for native chat/coding and specialist execution paths
- [x] Retrieval reranking wired after vector candidate retrieval with safe pre-training fallback
- [x] Specialist worker loopback authentication and media request/response limits
- [x] Security dependency maintenance, audit workflow, OAuth typing/verification fixes, OTP schema alignment, and bounded local execution

## Phase 5 — BobHS local orchestration
- [x] Authenticated BobHS controller/node foundation
- [x] Node registration, heartbeats, capability/model inventory, resource-aware placement, deployment leases, draining, lifecycle state, and atomic local state writes
- [x] Bounded Docker execution and persistent Docker volume declarations
- [x] Scheduler selection tests and root test wiring
- [x] Repository-side durable queue primitive with idempotency, claims, leases, retry, cancellation, and worker draining
- [x] Repository-side model lifecycle primitive with reference counting, idle eviction, and graceful shutdown
- [x] Repository-side backpressure, retry-jitter, and bounded runtime event primitives
- [x] Repository-side regression coverage for queue concurrency, model lifecycle concurrency, shared-state conflicts, artifact verification, deployment planning, and runtime policy
- [x] Repository-side execution coordinator combining durable queue claims, model lifecycle references, retry policy, cancellation/draining, and bounded runtime events
- [ ] Wire the execution coordinator into every live BobHS execution entrypoint and verify multi-worker behavior in the target environment

## Phase 6 — Train and verify every model
- [x] Repository-side native Bob evaluator now measures held-out test loss/perplexity, prompt smoke-test pass rate, malformed-artifact rejection, and optional regression gates
- [x] Repository-side specialist trainer now supports deterministic validation splits, best/latest checkpoints, resume validation, early stopping, finite-data checks, and bounded dataset loading
- [x] Repository-side specialist model smoke tests and CI compilation cover every declared specialist architecture and loss path
- [x] Repository-side specialist data preparation handles variable-length TTS mel targets safely
- [ ] Prepare the final eligible training datasets for Bob, Vector, Vanta, Echo, Flux, and reranking
- [ ] Train Bob for the required long-running experiment window and keep the best verified checkpoint
- [ ] Train every specialist with real eligible datasets and keep best verified checkpoints
- [ ] Evaluate every model with held-out data and reject broken or regressed checkpoints
- [ ] Verify automatic runtime selection and leasing through chat, coding, vision, speech, image, retrieval, and agent execution with real artifacts
- [ ] Build native media libraries and model weights on the target Windows machine and verify the Node-API addon

## Phase 7 — Native media and local multimodal runtime
- [ ] Broader native media codec support beyond PCM16 WAV without reintroducing child-process execution
- [ ] End-to-end local image, vision, speech, and media workflows verified on the target Windows machine
- [ ] Target-hardware performance profiling, memory limits, queue behavior, model load times, and failure recovery verified
- [ ] Real local-model quality evaluation completed against appropriate baselines

## Phase 8 — Production BobHS platform
- [ ] Production ingress and TLS
- [ ] Database-backed shared state and multi-controller coordination
- [ ] Persistent production volumes, model registry/inventory integration, rolling deployments, centralized logs, and backups
- [ ] Domains, health checks, failover, graceful draining, retries, and recovery verified across multiple nodes
- [ ] Portable model distribution so the same Bob family artifacts can move between laptop and production workers

## Phase 9 — Production security and reliability
- [ ] Production environment variables, secret handling, trusted model-weight distribution, retention, backups, and security monitoring verified
- [ ] External load testing, abuse testing, penetration testing, rate-limit validation, and failure-injection testing completed
- [ ] Final API/browser smoke tests, OAuth callback verification, real SMTP delivery verification, media verification, specialist verification, and sandbox end-to-end verification completed
- [ ] Privacy, deletion/export, audit, workspace isolation, and model-data boundaries rechecked end to end

## Phase 10 — Production scale
- [ ] Resource-aware multi-node scheduling proven under sustained production load
- [ ] Automatic capacity management, queue backpressure, priority handling, model warm/cold lifecycle, and recovery proven under load
- [ ] Multi-region or geographically distributed workers evaluated where genuinely useful and affordable
- [ ] Production observability, alerts, SLOs, backups, disaster recovery, and operational runbooks completed
- [ ] Large-user workload, concurrency, latency, cost, and model-quality targets measured and tuned
- [ ] BobAI production release signed off only after real environment, hardware, model, security, and scale verification
