# API Guide

This document describes the API conventions and the current high-level route structure.

## Base configuration

- Local development API: `http://localhost:3001` (unless `PORT` is changed).
- Business API routes are mounted at the root (for example `/stream`, `/chat`, `/images/generate`, and `/vision/analyze`). Health endpoints are available at `/health` and `/v1/health`.
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
| `/files` | File operations |
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


## Cancellation and failure handling

The current main-branch architecture is local-first. Chat and research synthesis use local Ollama; image generation/editing uses local Diffusers; voice uses local Whisper.cpp and Piper. The stream and voice-turn routes propagate client-disconnect signals between supported stages. Native media calls are synchronous, so a disconnect cannot guarantee immediate interruption of an in-progress native transcription or synthesis call. The web stream parser accepts LF and CRLF event separators. End-to-end cancellation, partial-response persistence, timeout behavior, and native runtime performance still require runtime verification.

Rate limiting is configured through API middleware. If distributed limiting is explicitly enabled and its backing service fails, requests are denied rather than falling back to uncoordinated per-process limits.

## Local-first provider notes

- Chat/coding/research synthesis: Ollama at the server-configured local endpoint. Pull the configured models before use.
- Image understanding: local Ollama multimodal model via `BOBAI_OLLAMA_VISION_MODEL`.
- Image generation/editing: local Diffusers model at `BOBAI_IMAGE_MODEL_PATH`.
- Speech recognition/synthesis: local Whisper.cpp/Piper assets and the compiled native media addon.
- Neon/PostgreSQL and Resend/SMTP are infrastructure services, not hosted AI-model inference.
- Do not configure hosted AI-model API keys for the local-first runtime. Do not claim a model is ready until local readiness and actual inference have been tested.

## Public-beta provider notes

- Hosted chat requires `BOBAI_PROVIDER=openai` and a server-side `OPENAI_API_KEY` in production.
- Hosted image generation/editing uses the Images API and `BOBAI_OPENAI_IMAGE_MODEL`; the current UI defaults to one low-quality image per request and accepts one reference image under 1 MB.
- Production startup fails closed until the operator confirms a hard provider-side monthly spend limit and sets `BOBAI_PROVIDER_SIDE_BUDGET_CONFIGURED=true`. That variable is an attestation, not an automatic billing integration.
- Do not expose provider keys to browser code. Provider/model access, spending limits, privacy terms, and live responses must be verified before public release.

### File processing recovery

- `POST /files/:id/reindex` retries extraction/indexing for an owned, non-deleted upload. Text and PDF files are re-indexed; supported image uploads are re-run through OCR and then indexing. The endpoint returns `202 Accepted` and exposes processing state through `GET /files/:id`.
