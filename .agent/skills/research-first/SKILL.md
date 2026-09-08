---
name: research-first
description: Gather relevant repository and source context before implementing non-trivial engineering work.
---

# Research first

Before changing code:

- inspect the existing implementation and route/service boundaries
- search for an existing equivalent before creating a new abstraction
- identify relevant tests, schemas, environment contracts, and security rules
- prefer the project's existing dependencies and provider abstractions
- preserve existing behavior outside the requested change

Do not fabricate provider capabilities, APIs, URLs, test results, or deployment state.
