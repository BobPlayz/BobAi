# BobAI handoff — 2026-09-13

The public Bob model family is Bob, Forge, Vanta, Echo, Flux, and Vector. Bob Core and runtime identifiers remain internal, and ordinary users do not receive scheduler or runtime registry state through normal model APIs. The admin runtime surface remains protected by the existing admin boundary.

The runtime layer covers the central text profiles and specialist capability set. Bob and Forge share the native model through reference-counted lifecycle management. Vector retrieval, Vanta vision, Echo speech, and Flux image generation have local execution adapters that activate only when their trained artifacts are configured. Specialist workers are loopback-only with per-worker bearer tokens, lazy checkpoint loading, bounded request handling, and shutdown handling. Echo now has a local speech-server boundary for its TTS artifact, with Griffin-Lim reconstruction to a WAV response; ASR can accept PCM16 WAV directly through the audio feature adapter.

The repository includes specialist dataset preparation, checkpoint serving, audio feature preparation for PCM16 WAV, and root commands for preparing and training the model family. The environment template exposes specialist artifact paths and resource controls. No trained checkpoint is claimed to exist until the user's machine actually produces it.

The remaining work is verification and production hardening. Full runtime-path verification still requires actual trained artifacts, broader codec support remains separate from the model layer, BobHS still needs durable production scheduling and shared state, and target Windows builds, training, end-to-end checks, security/load testing, and performance require the user's environment.

Before every future commit, roadmap.md and this handoff must both be updated. roadmap.md remains checklist-only and this handoff remains paragraph-only. The intent is to finish repository-side orchestration and execution first, then start the user's training only after code-side work is genuinely complete.
