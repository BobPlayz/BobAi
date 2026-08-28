# BobAI API

Base URL: `/v1`

## Authentication

`POST /auth/register` creates an account. Passwords must be 12–128 characters.

`POST /auth/login` returns a short-lived access token and refresh token.

`POST /auth/refresh` rotates the refresh token. Reuse of a revoked refresh token fails.

`POST /auth/logout` revokes a refresh token.

`POST /auth/otp/request` and `POST /auth/otp/verify` handle optional email verification. OTP requests and verification attempts are additionally rate-limited.

`POST /account/password-reset/request` starts password recovery. `POST /account/password-reset/confirm` consumes a short-lived reset token.

Protected requests use:

```text
Authorization: Bearer <access-token>
```

## Account

`GET /account/me` returns the authenticated profile.

`GET /account/export` returns the currently implemented personal-data export.

`GET /account/sessions` lists active sessions. `DELETE /account/sessions/:id` revokes one session and `DELETE /account/sessions` revokes all sessions.

`DELETE /account/me` starts account deactivation and revokes all sessions. Permanent deletion remains a deployment/retention-worker responsibility.

## Conversations

`GET /conversations` lists the authenticated user's conversations. `GET /conversations/:id` reads one conversation. `POST /conversations` saves a complete conversation snapshot and `DELETE /conversations/:id` removes it.

A personal workspace is created lazily for accounts that do not already have one, so clients do not need to expose workspace setup just to use normal chat persistence.

## Memory

`GET /memory` reads memories for the authenticated user. `POST /memory/remember` stores an explicit memory and `DELETE /memory` clears the user's memories.

Memory routes never trust a client-supplied user ID; workspace access is checked against the authenticated session. Normal chat also injects stored memories into the model context and stores messages that match BobAI's explicit-memory detector.

## API keys

API keys are scoped to a workspace and stored as hashes. The plaintext key is returned only when it is created.

```text
GET    /api-keys
POST   /api-keys
DELETE /api-keys/:id
```

Send the workspace UUID in `x-workspace-id` when targeting a specific workspace. The caller must be a workspace member.

## Authorization

Authenticated users may access only resources owned by them or by a workspace in which they have permission. Never trust a client-supplied user ID. Admin endpoints additionally require the configured admin identity and `admin` role.

## Models

The local model registry currently supports Qwen 2.5 3B, Qwen 2.5 7B, Qwen 2.5 Coder 1.5B, and Qwen 2.5 Coder latest through Ollama. Model selection is capability-aware and falls back to a configured compatible model when possible.

## Multimodal and research endpoints

`POST /vision/analyze` is an authenticated Ollama vision bridge. It accepts `{ image, prompt }` and requires `BOBAI_VISION_MODEL` to be configured.

`POST /research/search` is an authenticated provider-agnostic web-search bridge. It accepts `{ query, options }` and requires `BOBAI_RESEARCH_PROVIDER_URL` to be configured. The provider URL must use HTTPS in production.

Image, video, voice, and music routes use provider abstractions. Providers are activated only when configured. Local media providers are restricted to loopback addresses.

## Jobs and agents

Long-running agent and media operations are queued. Specialist agents work in the background while Bob remains the user-facing conversational agent. Local concurrency is bounded so idle agents do not continuously consume CPU/GPU resources.

## Errors and limits

Errors use JSON with an `error` field. JSON requests are bounded by `JSON_BODY_LIMIT`; rate limits return `429` and `Retry-After` where applicable. Media generation accepts at most four image outputs per request.

## Production

Production requires explicit database, CORS, agent-key, and admin configuration. Wildcard CORS and weak agent keys are rejected. Never commit `.env` or production credentials.
