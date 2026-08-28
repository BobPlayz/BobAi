# BobAI API

Base URL: `/v1`

## Authentication

`POST /auth/register` creates an account. Passwords must be 12–128 characters.

`POST /auth/login` returns a short-lived access token and refresh token.

`POST /auth/refresh` rotates the refresh token. Reuse of a revoked refresh token fails.

`POST /auth/logout` revokes a refresh token.

`POST /auth/otp/request` and `POST /auth/otp/verify` handle email verification.

`POST /account/password-reset/request` starts password recovery. `POST /account/password-reset/confirm` consumes a short-lived reset token.

Protected requests use:

```text
Authorization: Bearer <access-token>
```

## Account

`GET /account/me` returns the authenticated profile.

`GET /account/export` returns the currently implemented personal-data export.

`GET /account/sessions` lists active sessions. `DELETE /account/sessions/:id` revokes one session and `DELETE /account/sessions` revokes all sessions.

`DELETE /account/me` starts account deactivation and revokes all sessions. Permanent deletion is delegated to the configured retention worker.

## API keys

API keys are scoped to a workspace and stored as hashes. The plaintext key is returned only when it is created.

```text
GET    /api-keys
POST   /api-keys
DELETE /api-keys/:id
```

Send the workspace UUID in `x-workspace-id`. The caller must be a workspace member.

## Authorization

Authenticated users may access only resources owned by them or by a workspace in which they have permission. Never trust a client-supplied user ID. Admin endpoints additionally require the configured admin identity and `admin` role.

## Errors and limits

Errors use JSON with an `error` field. JSON requests are bounded by `JSON_BODY_LIMIT`; rate limits return `429` and `Retry-After` where applicable. Media generation accepts at most four image outputs per request.

## Media and creative skills

Image, video, voice, and music routes use provider abstractions. Providers are activated only when configured. Music supports generation/edit/analyze contracts, while local providers can be connected later without changing the public API.

## Jobs and agents

Long-running agent and media operations are queued. Specialist agents work in the background while Bob remains the user-facing conversational agent. Local concurrency is bounded so idle agents do not continuously consume CPU/GPU resources.

## Production

Production requires explicit database, CORS, agent-key, and admin configuration. Wildcard CORS and weak agent keys are rejected. Never commit `.env` or production credentials.
