# BobAI API

Base URL: `/v1`

## Authentication

`POST /auth/register`

```json
{"email":"user@example.com","username":"user","password":"..."}
```

`POST /auth/login` returns a short-lived access token and refresh token.

`POST /auth/refresh` rotates the refresh token.

`POST /auth/logout` revokes the current session.

Protected requests use:

```text
Authorization: Bearer <access-token>
```

## Authorization

Authenticated users may access only resources owned by them or by a workspace in which they have permission. Admin endpoints additionally require the configured admin identity and `admin` role.

## Errors

Errors use:

```json
{"error":{"code":"CODE","message":"message"}}
```

## Limits

JSON requests are limited by `JSON_BODY_LIMIT`. Rate limits return HTTP `429` with `Retry-After` when applicable. Media generation accepts at most four image outputs per request.

## Media

Local media providers are configured through environment variables. Providers must be loopback addresses; arbitrary internal or public URLs are rejected.

## Jobs

Long-running agent and media operations are queued. Jobs expose status and results through their job endpoints. Local concurrency is bounded so idle agents do not continuously consume CPU/GPU resources.

## Production

Production requires `DATABASE_URL`, `CORS_ORIGIN`, and `BOBAI_AGENT_KEY`. Wildcard CORS is rejected. Never commit `.env` or production credentials.
