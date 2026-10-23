# Model routing

Jarvis does not depend on one model. For every request it picks from the models the configured Ollama endpoint actually offers, and falls back to another one if that fails.

## How it works

1. **Discovery.** Jarvis lists models with `GET /api/tags` and reads each one's capabilities, context length and size from Ollama's own metadata (`capabilities`, `POST /api/show`). The list is cached for 5 minutes; if a refresh fails, the last good list is reused for up to an hour.
   - **Local Ollama / the Jarvis gateway:** the list is what is installed, so every listed model can run. Models too big for this computer's memory are skipped.
   - **Ollama Cloud:** the list is the public catalogue. Being listed does not mean your account may use it, so Jarvis learns that from real answers: a model that answers is marked as working; one that returns 403/404 is skipped for an hour (and if Ollama names an allowed model in the error, that one is tried next).
2. **Task.** Each request is classified as chat, coding, reasoning, vision (images) or a tool decision.
3. **Ranking.** Models must report the needed capability (for example `vision` for images) and a big enough context window. They are then ranked by measured reliability and time to first token, plus metadata signals: larger models with thinking support for coding and reasoning, smaller ones for quick chat, tool support for tool decisions. Names are never used.
4. **Fallback.** If a model is unavailable, denied, rate limited, overloaded or sends nothing within the first-token timeout, the next one is tried (at most 3 real attempts within 150 seconds). A bad API key or an unreachable server stops immediately. If a model fails after text has already been streamed, the partial answer is kept and an error is shown; a second model's answer is never spliced on.

Discovery never runs inference, so it costs nothing and downloads nothing. Jarvis never pulls models.

## Settings (all optional)

| Name | Default | What it does |
| --- | --- | --- |
| `BOBAI_OLLAMA_MODEL` | none | Preferred model for chat (a strong hint, not a requirement) |
| `BOBAI_OLLAMA_CODING_MODEL` / `BOBAI_OLLAMA_VISION_MODEL` | none | Preferred models for coding / images |
| `BOBAI_MODEL_ROUTING` | `auto` | `auto`, `fastest`, `strongest`, or `fixed` (only `BOBAI_OLLAMA_MODEL`, no fallback) |
| `BOBAI_MODEL_MAX_ATTEMPTS` | `3` | Real attempts per request (instant 403/404 refusals do not count) |
| `BOBAI_MODEL_ROUTE_BUDGET_MS` | `150000` | Total time for all attempts |
| `BOBAI_MODEL_FIRST_TOKEN_TIMEOUT_MS` | `45000` cloud / `120000` local | Give up on a model that sends nothing for this long |
| `BOBAI_MODEL_INVENTORY_TTL_MS` | `300000` | How long the model list is cached |
| `BOBAI_MODEL_ROUTING_LOG` | on | Set `false` to stop logging one line per attempt (model, task, timings, outcome; never prompts or answers) |

## Checking it

`GET /api/ready` shows `modelDiscovery` (models found, stale or not), `modelPicks` (the model each task would use right now) and `modelProblem` when something is wrong: `discovery_failed`, `no_compatible_model`, `all_candidates_failed`, `auth`, `not_configured` or `unreachable`. Each chat answer shows the model that wrote it.

## On an 8 GB laptop

Install one or two small models, for example `ollama pull qwen3.5:2b` (chat, code and images in one). Jarvis unloads other local models before switching so only one sits in memory.

## Chat compacting

When a chat no longer fits the model's window, Jarvis summarizes everything except the newest 8 messages and keeps those word for word. The summary is saved with the chat (`conversations.metadata.compaction`) and only extended after 6 more messages, or rebuilt if earlier messages changed. Replies that used a summary say so under the answer. `BOBAI_CONTEXT_COMPACTION=false` turns it off (old messages are then trimmed instead).

## Usage limits

Counters are shared across all server instances (`rate_limit_buckets`) and reset at midnight UTC (Brave: monthly). Defaults stay under each free tier; set the variable to change a limit, or `0` for unlimited.

| Limit | Variable | Default | Why |
| --- | --- | --- | --- |
| Messages per person per day | `BOBAI_LIMIT_CHAT_PER_USER_PER_DAY` | 60 | Ollama Cloud free plan has a small, unpublished allowance |
| Messages per day, whole site | `BOBAI_LIMIT_CHAT_PER_DAY` | 600 | Same |
| Login emails per day | `BOBAI_LIMIT_EMAILS_PER_DAY` | 450 (Gmail) / 90 (Resend) | Gmail ~500/day, Resend free 100/day |
| Cricket feed calls per day | `BOBAI_LIMIT_CRICKET_CALLS_PER_DAY` | 95 | CricketData.org free 100/day; after that web search is used |
| Brave searches per month | `BOBAI_LIMIT_BRAVE_SEARCHES_PER_MONTH` | 900 | ~$5 free credit ≈ 1,000 searches; after that DuckDuckGo is used |
| Pictures per person per day | `BOBAI_LIMIT_IMAGES_PER_USER_PER_DAY` | 20 | Pollinations is free but shared |
| Spoken characters per month | `BOBAI_LIMIT_SPEECH_CHARACTERS_PER_MONTH` | 15,000 | ElevenLabs free plan ≈ 20,000 characters with Flash v2.5 |
| Spoken characters per person per day | `BOBAI_LIMIT_SPEECH_CHARACTERS_PER_USER_PER_DAY` | 3,000 | Keeps one person from using the month's voice |
| Seconds of speech heard per month | `BOBAI_LIMIT_SPEECH_INPUT_SECONDS_PER_MONTH` | 3,600 | ElevenLabs Scribe uses the same free credits |
| Seconds of speech heard per person per day | `BOBAI_LIMIT_SPEECH_INPUT_SECONDS_PER_USER_PER_DAY` | 600 | Same |
| Login code requests per IP per day | `BOBAI_LIMIT_CODE_REQUESTS_PER_IP_PER_DAY` | 20 | Stops one visitor using up the day's login emails |
| Login code requests per email per day | `BOBAI_LIMIT_CODE_REQUESTS_PER_EMAIL_PER_DAY` | 8 | Stops someone flooding another person's inbox |

People see how many messages they have left in Settings.
