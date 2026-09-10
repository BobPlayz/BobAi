# BobAI final backend audit

## Completed in this pass

- production configuration validation
- production error sanitization
- security audit event helper
- security integration smoke-test entrypoint
- concise API contract documentation
- security test command
- dependency review of the API package
- rate-limit memory cap
- authenticated session and admin security hardening
- provider-neutral Bob model gateway and model registry review
- Ollama-independent model-serving contract
- consent-gated Bob training policy
- reproducible Bob-0.1 LoRA/SFT training kit
- synthetic starter dataset
- dataset sanitization, deterministic deduplication, and train/validation/test splitting
- fixed evaluation prompts and adapter smoke evaluator
- model-version registry metadata
- CI validation for the training dataset/policy helpers

## Security cases to run against an isolated Neon test database

- user A cannot read/update/delete user B resources
- workspace member cannot access a workspace they do not belong to
- normal users cannot access admin endpoints
- refresh tokens cannot be replayed after rotation
- revoked sessions remain rejected
- authentication rate limits trigger and recover
- agent tool scopes reject unauthorized tools
- duplicate job requests are idempotent where required
- cancelled jobs do not continue execution
- media requests reject more than four image outputs
- malformed media-provider responses fail safely
- non-loopback media provider URLs are rejected
- training examples without explicit eligibility/consent are rejected
- secrets and direct identifiers are removed before dataset output
- trained artifacts are not committed to the source repository

## Environment-dependent items

The repository cannot prove live Neon configuration, GPU/model availability, actual local training completion, local inference-server behavior, or the separate Bob Coding Agents installation without those environments. These are intentionally not represented as completed.

The first training target is intentionally experimental. A successful LoRA run does **not** mean Bob-0.1 is production-quality or frontier-level.

## Model replacement guarantee

The application contract is intentionally independent of the training framework. A future internally trained Bob model can be served through the existing model gateway as long as the serving endpoint implements the documented OpenAI-compatible chat contract. Training hardware, base model, LoRA/other post-training method, and inference runtime can change without requiring a rewrite of BobAI's memory, tools, agents, or UI.

## Cleanup rule

Remove only files with no imports/references and no runtime/build role. Consolidate files only when implementation and responsibility are genuinely duplicated; similarly named route/service layers are not duplicates by themselves.
