# BobAI roadmap

## Repo-side
- [x] Unified Bob runtime and bounded tool loop
- [x] Input, approval, audit, cancellation, network, provider, media, bundle, result, and agent-plan safeguards
- [x] Repository preflight and CI validation
- [x] Memory, research, documents, data, coding, browser, agents, automation, multimodal, and deployment foundations
- [x] First-class computer, MS Paint, and Blender/3D tool boundaries with approvals and verification
- [x] Source checking, calibrated uncertainty, anti-sycophancy, emotional attunement, failure recovery, and untrusted tool-output behavior
- [x] Licensed-data provenance, deterministic deduplication, multimodal manifest validation, and rights-gated teacher distillation
- [x] Scalable from-scratch production Transformer with RoPE, RMSNorm, SwiGLU, GQA, SDPA/Flash Attention, tied embeddings, checkpointing, mixed precision, DDP, validation, and resumability
- [x] Production BPE tokenizer accepts raw knowledge text and instruction conversations
- [x] Production pretraining and instruction-tuning stages with weight transfer
- [x] Deterministic pretraining split and production checkpoint evaluation
- [x] Fresh-run production pipeline installs dependencies, prepares corpora/splits, trains the tokenizer, pretrains, and automatically continues into instruction tuning
- [x] Fresh-run stage-transition bug fixed so instruction tuning is not skipped after successful pretraining
- [x] Resume pipeline restores saved stage/profile/settings automatically
- [x] Live training status includes stage, profile, step/total, progress, loss, validation loss, elapsed time, ETA, and checkpoint path
- [x] Training control supports pause, status, resume, and stop
- [x] Cooperative pause/stop now checkpoints cleanly from inside the trainer instead of force-killing the process
- [x] Normal checkpoint cadence reduced to limit unnecessary large writes on USB storage, while pause/stop always force an immediate latest checkpoint
- [x] Windows `bob-training.cmd` provides one-command start plus pause/status/resume/stop and roots itself to the repo directory
- [x] Training/control paths are repository-relative so the project can move to a USB drive such as `D:` without hard-coded drive edits
- [x] npm shortcuts expose `model:start`, `model:pause`, `model:status`, `model:resume`, and `model:stop`
- [x] Production model local worker with bearer auth and configurable bounded worker pool
- [x] Node runtime auto-selects production artifacts and supports explicit production paths
- [x] Voice runtime uses configured voice provider before local/echo fallbacks
- [x] Web voice input records microphone audio, sends it through authenticated transcription, and places the transcript into the composer
- [x] Web voice output path can synthesize and play provider-returned audio
- [x] Voice, image, video, music, design, computer, and desktop provider environment contracts are documented
- [x] Training capability map explicitly covers knowledge pretraining, UI/UX design, multilingual behavior, coding, voice, media, desktop, memory, security, and recovery
- [x] Model-training CI compiles and tests production, tokenizer, pretraining-split, and capability sources

## Environment
- [ ] Finish copying/cloning the repository to its final USB location on `D:`
- [ ] Run `D:\BobAi\bob-training.cmd start` (adjust folder name if needed)
- [ ] Observe actual throughput/ETA on the laptop before deciding whether to change profile/corpus size
- [ ] Acquire/mount licensed multimodal assets and any authorized teacher outputs selected for later training
- [ ] Configure and verify real/local desktop/computer, voice, search, image, video, music, design, and other production providers
- [ ] Verify target-environment BobHS workers and distributed deployment
- [ ] Verify artifact/object storage and production backups
- [ ] Run load, resilience, security, and concurrency verification for roughly 2,000 daily users
- [ ] Build/verify native Windows media components on the target machine
- [ ] Run final model quality/evaluation gates on trained artifacts
