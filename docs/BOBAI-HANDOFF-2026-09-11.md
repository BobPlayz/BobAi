BobAI remains a single user-facing Bob model with a central tool policy boundary. Repository-side protections cover bounded model-tool execution, approvals, input validation, cancellation, audit events, SSRF defenses, bounded provider/webhook responses, model-bundle integrity, native audio limits, execution-result limits, and capability-neutral labels. Agent orchestration now rejects invalid budget values, caller-controlled execution states, and invalid resource estimates.

The repository does not claim real provider, target-hardware, production deployment, long-running training, or final release verification. Those require the actual environment, providers, hardware, credentials, or production infrastructure.

Future changes must inspect main first and update roadmap.md and this handoff together. Related files may be changed in one coherent commit. Never invent files, features, test results, model quality, or environment results.
