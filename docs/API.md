# API Guide

This document describes the API conventions and the current high-level route structure.

## Base configuration

- Local development API: `http://localhost:3001` (unless `PORT` is changed).
- Business API routes are mounted at the root (for example `/stream`, `/chat`, `/images/generate`, and `/vision/analyze`). On Vercel the website forwards `/api/*` to the API and the prefix is stripped. Health: `/health` (process is up) and `/ready` (database, email, model discovery and the model each task would use; names of missing settings, never values).
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
| `/chat` | Non-streaming chat completion and tool execution |
| `/stream` | Streaming chat |
| `/conversations` | Conversation persistence |
| `/messages` | Message operations |
| `/settings` | User settings |
| `/memory` | Memory operations |
| `/files` | File upload/list/download/delete, text search, and processing status |
| `POST /files/:id/reindex` | Retry extraction/indexing or image OCR for an owned upload; returns `202 Accepted` |
| `/research/search` | Basic web search with source preferences and saved research sessions |
| `/deep-research` | Multi-query research with fetched evidence and local Ollama synthesis |
| `/images/generate` | Local Diffusers image generation and image-to-image editing; requires local model files |
| `/voice/status` | Local Whisper.cpp/Piper readiness |
| `/voice/transcribe` | Local Whisper.cpp audio transcription |
| `/voice/synthesize` | Local Piper speech synthesis |
| `/voice/turn` | One-shot local voice turn: transcription → local chat → speech synthesis; requires all local runtimes and model assets |
| `/agents` | Agent execution |
| `/automation` | Automation management |
| `/projects` | Project management |
| `/tools` | Tool discovery and execution |
| `/model/status` | Model routing status (discovery, picks per task) |
| `/vision/analyze` | Local Ollama multimodal image understanding |
| `/ffmpeg` | Local native WAV validation/probing |

Other route groups are registered in `apps/api/src/routes/index.ts`. Check the route implementation for endpoint-specific request schemas and permissions. Media routes have bounded body limits that differ from the 2 MB default; oversized requests return HTTP 413.

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


## Streaming chat (`POST /stream`)

Server-sent events: `token` events with text, then one `done` event (`reply`, `title`, `model` that wrote it, `fallbacks`, `conversationId`, optional `liveData` and `approval`) or one `error` event with a message that is safe to show. The user's message and the reply are saved with the client's message IDs, so retries never duplicate history. If the model fails after text was sent, the partial text is kept and an error follows; another model's answer is never added to it. Client disconnects cancel the model request.

## Models

All AI runs through Ollama (local, the Jarvis gateway, or Ollama Cloud). The model for each request is chosen automatically from the models the endpoint offers, with fallback; see [MODEL_ROUTING.md](MODEL_ROUTING.md). `modelId` in a request may be `bob` (automatic), `bob-coder` (route as coding) or an exact model name (explicit choice). No hosted AI-provider keys are used.

Rate limiting is configured through API middleware. If distributed limiting is enabled and its backing store fails, requests are denied rather than falling back to per-process limits.

### File processing recovery

- `POST /files/:id/reindex` retries extraction/indexing for an owned, non-deleted upload. Text and PDF files are re-indexed; supported image uploads are re-run through OCR and then indexing. The endpoint returns `202 Accepted` and exposes processing state through `GET /files/:id`.

### Upload retention policy

The scheduled retention worker soft-deletes image uploads after 30 days and other supported document uploads after 90 days by default. Configure `BOBAI_UPLOAD_IMAGE_RETENTION_DAYS` and `BOBAI_UPLOAD_DOCUMENT_RETENTION_DAYS` to an integer from `1` to `3650`; use `0` to disable automatic deletion for that category. Expired uploads and their indexed chunks are removed from user-visible/searchable results before object storage cleanup is attempted. Storage cleanup failures are reported in the worker result for operator follow-up.
