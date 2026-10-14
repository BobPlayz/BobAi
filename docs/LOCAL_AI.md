# Local AI integration status

Ollama support has been retired from the public-beta implementation plan. BobAI's intended public service uses a configured hosted provider for general chat, coding, and provider-backed image understanding. Do not install Ollama or set Ollama environment variables for this project.

BobAI still contains historical native-runtime and model-training source paths. They are not a promise of a supported local-first product and must not be advertised as such. Do not train a model as part of normal setup or deployment.

## Public-beta rules

- Keep provider credentials on the server and never expose them in browser bundles.
- Keep hosted AI disabled until a provider is selected, its data-processing terms are reviewed, a hard monthly spending cap is configured, and the ₹500 monthly target has been tested.
- Prefer a cancellable monthly or usage-based hosting plan with no long-term commitment. Confirm cancellation timing, automatic renewal, data export, and deletion before selecting a provider.
- Never expose a local inference endpoint or coding-agent bridge directly to the public internet.
- For coding tasks, use an isolated sandbox with network access disabled by default. Require explicit approval for repository writes and consequential side effects.
- Provider availability, model capabilities, pricing, and age restrictions must be verified against the chosen provider before public beta.

This document records the product decision, not proof that all legacy local-runtime code has already been removed. Final repository-wide reference audit and tests remain required.
