# Hosted AI provider setup

BobAI can use an existing OpenAI-compatible chat API. This does not train a model. The hosted provider is opt-in because API usage can cost money.

## Configure the API server

1. Copy the relevant settings from `.env.example` into the API server's private environment file.
2. Set `BOBAI_PROVIDER=openai`.
3. Set `OPENAI_API_KEY` to a key you are authorized to use. Keep it on the server only.
4. Optionally set `BOBAI_OPENAI_BASE_URL` and `BOBAI_OPENAI_MODEL` for a compatible provider/model.
5. Restart the API server and check its model status endpoint before testing chat.

Default model: `gpt-4o-mini`. Verify current provider pricing, data-use terms, model availability, rate limits, and applicable age restrictions before use. The model name is configurable because availability and pricing can change.

## Safety and cost

- Never prefix the secret with `NEXT_PUBLIC_`; that would expose it to browser code.
- The provider is not enabled unless `BOBAI_PROVIDER=openai` is set.
- The adapter caps input size, response size, output tokens, and request timeout.
- Provider errors are returned as bounded error messages. The API key is not included in status output or error messages.
- This adapter does not create a hard monetary budget. For production, startup now fails closed unless the hosted provider is selected, the API key exists, the configured target is exactly ₹500/month, and `BOBAI_PROVIDER_SIDE_BUDGET_CONFIGURED=true`. Set and verify a hard provider-side monthly spending cap before setting that flag. The flag is an operator attestation, not an automatic billing API integration. Prefer a monthly or usage-based plan with no long-term commitment and verify cancellation timing before purchase.
- Requests sent to a hosted provider leave the local machine and are subject to that provider's data-processing terms.
- Ollama is not a supported option in the public-beta branch. Do not expose or document a local-model fallback.

## Quick configuration example

```dotenv
BOBAI_PROVIDER=openai
OPENAI_API_KEY=
BOBAI_OPENAI_BASE_URL=https://api.openai.com/v1
BOBAI_OPENAI_MODEL=gpt-4o-mini
```

The empty key is intentional. Add a valid secret only in your private API environment, never in Git.


## Streaming cancellation

The hosted stream adapter accepts an optional `AbortSignal` and combines it with the configured request timeout. The API stream route is intended to abort the provider fetch when the browser disconnects. Verify cancellation, partial-response persistence, provider compatibility, and timeout behavior before enabling a paid provider. This does not implement a hard monetary budget; provider-side limits are still mandatory.