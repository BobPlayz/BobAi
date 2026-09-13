# BobAI handoff — 2026-09-13

The public Bob model family is Bob, Forge, Vanta, Echo, Flux, and Vector. Bob Core and runtime identifiers remain internal, and ordinary users do not receive scheduler or runtime registry state through normal model APIs. The admin runtime surface remains protected by the existing admin boundary.

The runtime manager now covers the central text profiles plus the specialist capability set. Bob and Forge share the native model through reference-counted lifecycle management. Vector retrieval, Vanta vision, Echo speech, and Flux image generation have local execution adapters that activate only when their trained artifacts are configured. Before those artifacts exist, existing safe local fallbacks or explicit unavailable states remain in place. Specialist workers are loopback-only with per-worker bearer tokens and bounded request handling.

The repository also includes specialist dataset preparation, specialist checkpoint serving, audio feature preparation for PCM16 WAV, and root commands for preparing and training the model family. The environment template now exposes the specialist artifact paths and runtime controls. These changes are repository-side only and do not claim that any checkpoint has been trained.

The remaining work is now primarily verification and production hardening, plus any missing execution edge cases discovered by build and test. Target Windows native media compilation, actual model training, real specialist datasets, broader codecs, production BobHS persistence and ingress, final end-to-end verification, security/load testing, and performance remain environment-dependent. They must not be marked complete until actually verified.

Before every future commit, roadmap.md and this handoff must both be updated. roadmap.md remains checklist-only and this handoff remains paragraph-only. The intent is to finish repository-side orchestration and execution first, then start the user's training only after code-side work is genuinely complete.
