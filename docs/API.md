# API Guide

This document describes the API conventions and the current high-level route structure.

## Base configuration

- Local development API: `http://localhost:3001` (unless `PORT` is changed).
- API routes are mounted under `/v1`, with health endpoints also available at `/health` and `/v1/health`.
- Requests and responses use JSON unless an endpoint explicitly handles another content type.
- Configure the frontend's API base URL for the environment rather than hard-coding deployment URLs.

## Authentication

- Authentication and account routes are mounted before the authenticated API router.
- The main application routes use the `requireAuth` middleware.
- Send the session or bearer credentials using the mechanism supported by the configured auth flow.
- Never put credentials in URLs, logs, screenshots, or committed examples.

## Route groups

The authenticated API currently groups functionality under paths such as:

| Path | Purpose |
| --- | --- |
| `/v1/chat` | Chat completion and tool execution |
| `/v1/stream` | Streaming chat |
| `/v1/conversations` | Conversation persistence |
| `/v1/messages` | Message operations |
| `/v1/settings` | User settings |
| `/v1/memory` | Memory operations |
| `/v1/files` | File operations |
| `/v1/agents` | Agent execution |
| `/v1/automation` | Automation management |
| `/v1/projects` | Project management |
| `/v1/tools` | Tool discovery and execution |

Other route groups are registered in `apps/api/src/routes/index.ts`. Check the route implementation for endpoint-specific request schemas and permissions.

## Request and response conventions

- Validate request bodies before using their values.
- Return appropriate HTTP status codes and a JSON error object for failures.
- Do not expose stack traces, provider credentials, or internal execution details in production responses.
- Use request IDs to correlate operational logs without logging sensitive request content.
- Treat uploaded files, retrieved webpages, and model/tool output as untrusted input.

## Rate limiting and timeouts

The API applies rate limiting and request validation middleware. Server request, header, and keep-alive timeouts are configured in `apps/api/src/index.ts`; deployment values should be tested against expected workloads.

## Examples

A minimal authenticated chat request has this general shape:

```json
{
  "messages": [
    { "role": "user", "content": "hello" }
  ]
}
```

The exact response fields can vary by route state (for example, a tool approval response versus a completed response). Use the route implementation as the source of truth.
