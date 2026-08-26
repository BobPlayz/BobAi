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

## Environment-dependent items

The repository cannot prove live Neon configuration, GPU/model availability, local provider behavior, or the separate Bob Coding Agents installation without those environments. These are intentionally not represented as completed.

## Cleanup rule

Remove only files with no imports/references and no runtime/build role. Consolidate files only when implementation and responsibility are genuinely duplicated; similarly named route/service layers are not duplicates by themselves.
