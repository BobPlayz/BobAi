# BobAI security policy

## reporting

If you discover a security vulnerability, do not publish exploit details publicly. Report it privately to the project maintainer through the repository's configured security contact.

## security requirements

- Authentication and authorization are separate controls.
- Every resource endpoint must enforce object-level authorization and workspace isolation.
- Client-supplied user IDs must never be treated as proof of identity.
- Agent and automation capabilities must use explicit server-side authorization and least privilege.
- External provider URLs must be server-configured; user input must not select arbitrary destinations.
- Secrets must remain in environment variables or a secret manager and must never be committed.
- Uploaded files are untrusted input and must be validated before processing.
- Production errors must not expose stack traces, database details, credentials, or provider responses.
- Sensitive operations should be rate-limited and auditable.

## disclosure

Please provide a concise description, affected endpoint/component, impact, reproduction steps where safe, and any relevant logs with secrets removed.
