# Security Guide

Security practices for Jarvis development and deployment.

## Core principles

- Treat security as a default requirement, not a final checklist.
- Apply least privilege to users, services, agents, and tools.
- Validate and bound untrusted input.
- Keep secrets out of source control, logs, URLs, and client bundles.
- Prefer explicit, auditable behavior over implicit trust.

## Authentication and authorization

- Keep protected routes behind the authentication middleware.
- Enforce ownership and workspace access in database queries.
- Do not trust user IDs, workspace IDs, project IDs, or permission claims supplied by clients without server-side validation.
- Use strong, unique authentication secrets in production and rotate them when exposed.

## Secrets and environment

- Store credentials in environment variables or the deployment platform's secret manager.
- Keep `.env` files and private keys out of Git.
- Use only non-sensitive example values in `.env.example`.
- Restrict access to production secrets and databases.

## API protection

- Keep request body and upload size limits enabled.
- Use rate limiting, request validation, safe error responses, and appropriate timeouts.
- Configure explicit CORS origins in production and serve the API over HTTPS.
- Protect cookie-authenticated state-changing requests with origin and CSRF validation.
- Avoid exposing internal stack traces or provider details to clients.

## AI, files, and tools

- Treat user messages, uploaded files, retrieved pages, memories, and model/tool outputs as untrusted data.
- Never allow content from those sources to override system policy or authorization.
- Require appropriate permission and approval for sensitive tool actions.
- Bound tool inputs, outputs, execution time, and retries.
- Do not store passwords, access tokens, private keys, or other secrets in long-term memory.

## Data protection

- Scope reads and writes to the authenticated user and workspace.
- Minimize sensitive data collection and retention.
- Use encryption in transit and protect database backups.
- Verify backup integrity and periodically test restoration.
- Avoid logging message bodies, uploaded content, credentials, or other sensitive payloads.

## Incident response

1. Contain the affected credential, service, or integration.
2. Rotate exposed secrets and revoke compromised sessions or keys.
3. Preserve relevant audit information without copying sensitive data unnecessarily.
4. Identify and patch the cause.
5. Verify recovery and document follow-up actions.


## Current state (October 2026)

- Production mode is on for the live site: CSRF origin checks, Secure/HttpOnly/SameSite=strict cookies, redacted errors, explicit CORS origins (the deployment's own address is added automatically; localhost values copied from `.env.example` are ignored on Vercel).
- Login codes and tokens are hashed, codes are single use with attempt and rate limits, and codes are never logged.
- Model credentials stay on the server; the Ollama gateway needs a bearer token, never forwards model downloads or deletes, and keeps Ollama on 127.0.0.1. Routing logs record model names and timings only.
- Uploads are validated and must pass a malware scanner in production (fail closed). Fetched web pages are blocked from private addresses and treated as untrusted.
- `npm audit` reports 0 vulnerabilities (Next.js 16.4.2 patches a critical image-optimizer advisory). CodeQL and a secret scan run in CI.
- Not done: a professional penetration test and a backup restore drill.
