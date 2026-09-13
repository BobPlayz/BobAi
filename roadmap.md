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

## Phase 3 — Unified capability runtime
- [x] One user-facing native model is registered for chat, reasoning, coding, fast responses, and the future multimodal capability surface
- [x] Specialist capability packages are treated as internal capabilities rather than user-facing model personalities
- [x] Specialist checkpoint serving, lazy loading, authentication, bounded requests/responses, lifecycle shutdown, and artifact existence checks
- [x] Specialist execution adapters with runtime leasing and safe pre-training behavior
- [x] Speech PCM16 WAV boundaries and CTC token handling

## Phase 4 — Smart runtime and security
- [x] Internal model runtime registry with resource-aware loading, idle eviction, request leasing, and task planning
- [x] Hidden internal orchestration with admin-only runtime inspection and no normal-user scheduler exposure
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
- [x] Repository-side persistent shared-state adapter with optimistic SQL version checks
- [x] Repository-side model bundle manifest and SHA-256 distribution validation
- [x] Repository-side runtime counters and health-check helpers
- [x] Wire the execution coordinator into the live BobHS node execution entrypoint
- [ ] Verify multi-worker BobHS behavior in the target environment

## Phase 6 — Unified AI and verification
- [x] The same main model produces validated tool-selection requests against the central tool registry instead of exposing separate model personalities
- [x] Tool-selection parsing fails closed on malformed output, unknown tools, invalid arguments, and bounded tool-call counts
- [x] Chat asks the same main model for a tool decision before direct response or tool execution
- [x] Repository-side executor registry covers every currently registered tool with bounded local/provider adapters
- [x] Tool results are fed back to the same main model for additional tool selection or final response
- [x] Tool-loop tests cover result feedback, approval boundaries, bounded serialization, target URL safety, and global tool disabling
- [x] Repository-side tool execution has a global disable switch and bounded provider response reads
- [x] Browser and website-test targets reject URL credentials, private network targets, and production non-HTTPS targets
- [x] User-facing chat always selects the single Bob model for response and tool routing
- [x] Repository environment templates expose one main model configuration and no obsolete user-facing specialist model names
- [x] Canonical main tree restores the unified tool-loop implementation after repository write correction
- [ ] Verify every tool adapter against its real provider or local implementation
- [ ] Prepare the final eligible training datasets for the unified model and supporting capabilities
- [ ] Train the unified model for the required long-running experiment window and keep the best verified checkpoint
- [ ] Evaluate the unified model with held-out data and reject broken or regressed checkpoints
- [ ] Verify automatic tool selection and execution through chat, coding, vision, speech, image, retrieval, and agent workflows with real artifacts
- [ ] Build native media libraries and model weights on the target Windows machine and verify the Node-API addon

## Phase 7 — Native media and local multimodal runtime
- [ ] Broader native media codec support beyond PCM16 WAV without reintroducing child-process execution
- [ ] End-to-end local image, vision, speech, and media workflows verified on the target Windows machine
- [ ] Target-hardware performance profiling, memory limits, queue behavior, model load times, and failure recovery verified
- [ ] Real local-model quality evaluation completed against appropriate baselines

## Phase 8 — Production BobHS platform
- [x] Repository-side persistent shared-state contract and atomic optimistic SQL adapter
- [x] Repository-side portable model-bundle manifest and artifact integrity contract
- [x] Repository-side rolling deployment planner and runtime health/metrics primitives
- [ ] Production ingress and TLS configuration and live verification
- [ ] Production database connection wiring and multi-controller coordination in the live BobHS process
- [ ] Persistent production volumes, model registry/inventory integration, centralized logs, and backups wired to the live deployment
- [ ] Domains, health checks, failover, graceful draining, retries, and recovery verified across multiple nodes
- [ ] Portable model distribution executed against real workers and artifacts

## Phase 9 — Production security and reliability
- [x] Repository preflight validates required project structure, required scripts, handoff/roadmap format, and secret-shaped values in the example environment
- [x] Repository CI preflight and model-training validation workflows are defined with least-privilege read permissions
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
