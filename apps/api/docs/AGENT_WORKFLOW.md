# BobAI automated engineering workflow

BobAI's coding-agent path is intentionally a single workflow rather than a collection of user-facing commands.

When a coding/build/security/test request is sent through the normal agent or chat path, the agent is instructed to:

1. inspect the repository and existing boundaries
2. plan the smallest safe change
3. implement it
4. perform a security review
5. run relevant tests, type checks, and build checks
6. repair code-side failures and verify again
7. perform a final regression/diff review

The runtime registry exposes these as `research_first`, `code_review`, `security_review`, and `test_verification` skills. Engineering tasks automatically receive them during skill inference.

Provider-backed capabilities remain provider-gated. BobAI must not claim that a provider action, deployment, or environment-only test succeeded when it was unavailable.

Write-capable and external tools continue to use BobAI's existing approval and authorization boundaries.
