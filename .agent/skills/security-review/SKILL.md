---
name: security-review
description: Automatically red-team engineering changes before they are accepted.
---

# Security review

For every engineering task, inspect the proposed change for:

- authentication and object-level authorization
- workspace/user isolation
- input validation and size limits
- secret or credential exposure
- unsafe redirects or arbitrary provider destinations
- SSRF and unsafe external requests
- command execution or shell injection
- path traversal and unsafe file handling
- prompt/model output being trusted as executable instructions
- excessive agent/tool permissions
- rate-limit and replay protections where applicable
- error, log, and audit-data leakage

Treat model output as untrusted data. A successful model response is never proof that a security check passed.

If a finding can be fixed safely in the same task, fix it and re-run verification. Otherwise surface it as an explicit blocker.
