# Ollama gateway: use your own computer's AI from the hosted site

The website and API on Vercel cannot reach `localhost` on your laptop. The **Jarvis Ollama gateway** (`apps/ollama-gateway`) fixes that safely:

```
Browser ──► Vercel (website + API) ──HTTPS + secret token──► Cloudflare Tunnel ──► gateway (your PC) ──► Ollama (127.0.0.1 only)
```

- Ollama stays bound to `127.0.0.1`. It is **never** exposed directly.
- The gateway only forwards the five endpoints Jarvis needs (`/api/chat`, `/api/generate`, `/api/embed`, `/api/tags`, `/api/ps`). Model downloads, deletes and copies are refused.
- Every request needs `Authorization: Bearer <GATEWAY_TOKEN>`. Only models in `GATEWAY_ALLOWED_MODELS` are allowed.
- One request runs at a time by default (right for 8 GB RAM); a few more wait in a queue, the rest get "busy, try again".
- Answers stream through; if the user closes the page, Ollama stops working on it.

Cost: free. Cloudflare Tunnel's quick tunnels need no account; a named tunnel needs a free Cloudflare account.

## 1. Start Ollama and the gateway (on your PC)

```powershell
ollama pull qwen3.5:2b
# Make a long random token once and keep it secret (do not commit it):
node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"
```

Add to your `.env` (root of the repo):

```
GATEWAY_TOKEN=<the token you just generated>
GATEWAY_ALLOWED_MODELS=qwen3.5:2b
```

Then run it in its own terminal:

```powershell
npm run gateway
```

Check it: open <http://127.0.0.1:11435/health>. It should say `{"status":"ok"}`.

## 2. Give it an HTTPS address with Cloudflare Tunnel

Install `cloudflared` from Cloudflare (Windows: `winget install --id Cloudflare.cloudflared`), then:

```powershell
cloudflared tunnel --url http://127.0.0.1:11435
```

It prints an address like `https://something-random.trycloudflare.com`. That address changes every time you restart the quick tunnel. For a permanent address, create a free named tunnel in the Cloudflare dashboard (Zero Trust → Networks → Tunnels) and point it at `http://127.0.0.1:11435`.

## 3. Tell the hosted API where the gateway is

In Vercel → your project → Settings → Environment Variables (Production), set:

| Name | Value |
| --- | --- |
| `BOBAI_OLLAMA_BASE_URL` | your tunnel address, e.g. `https://something-random.trycloudflare.com` |
| `BOBAI_OLLAMA_API_KEY` | the same `GATEWAY_TOKEN` |
| `BOBAI_OLLAMA_MODEL` | `qwen3.5:2b` |

Environment variable changes only apply to **new** deployments: redeploy after saving (Deployments → ⋯ → Redeploy).

## Notes

- Your PC must be on, with Ollama, the gateway and the tunnel running, for hosted chat to work. When it is off, Jarvis says the model is unavailable instead of pretending.
- Voice and local image generation stay on your PC; they are not exposed through the gateway.
- Settings: `GATEWAY_PORT` (11435), `GATEWAY_HOST` (127.0.0.1), `GATEWAY_MAX_CONCURRENT` (1), `GATEWAY_QUEUE_LIMIT` (8), `GATEWAY_TIMEOUT_MS` (300000), `GATEWAY_RATE_LIMIT_PER_MINUTE` (120).
