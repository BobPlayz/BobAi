---
name: test-and-verify
description: Automatically verify engineering changes and repair regressions before reporting completion.
---

# Test and verify

After implementation:

1. run the narrowest relevant tests
2. run the relevant type/build checks
3. inspect failures and fix code-side failures
4. repeat verification after fixes
5. perform a final regression review

Prefer deterministic checks over claims from model output. Keep unrelated failures separate from failures caused by the current change.

Do not require the user to manually issue a sequence of verification commands when the authorized agent can perform the checks itself.
