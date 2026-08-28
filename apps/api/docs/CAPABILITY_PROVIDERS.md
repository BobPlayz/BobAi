# BobAI capability provider contract

BobAI keeps user-facing capabilities independent from any single AI vendor. Provider URLs are configured through environment variables and may point to local services during development or HTTPS services in production.

## Capability endpoint

Authenticated API route:

`POST /v1/capabilities/:capability`

The request body is passed to the configured provider together with a `capability` field. The provider should return JSON describing the generated/analyzed result.

The capability status endpoint is:

`GET /v1/capabilities`

It reports whether each provider URL is configured and whether its optional credential is present. Secrets themselves are never returned.

## Current provider-backed capabilities

- `image_upscale`
- `background_removal`
- `object_removal`
- `image_editing`
- `video_generation`
- `image_to_video`
- `talking_image`
- `talking_avatar`
- `face_swap`
- `short_clip_finder`
- `voice_synthesis`
- `speech_to_text`
- `meeting_transcription`
- `music_generation`
- `music_discovery`
- `diagram_generation`
- `sketch_to_ui`

Existing dedicated routes remain intact for chat, image generation, vision, research, voice, music, files, and agents. The capability bridge only fills the missing provider-neutral operations; it does not replace those existing routes.

## Provider configuration

Each provider has a URL and, where needed, an optional bearer credential. Development HTTP is allowed only for loopback providers. Production provider URLs must use HTTPS.

Provider requests have a bounded timeout and response-size limit. Provider errors are returned as `503` responses instead of being presented as successful AI actions.

## Build capabilities

Prompt-to-app, prompt-to-website, AI code editing, and build/deploy continue through the existing coding-agent/task-queue architecture. They are deliberately not duplicated as a second remote provider API.

## Activation

Engineering can ship and test the API without any vendor account. A capability becomes live when Bob configures its provider URL/key or a compatible local service. Until then the API reports the capability as unavailable rather than pretending it works.
