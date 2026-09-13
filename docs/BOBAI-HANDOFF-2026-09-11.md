BobAI remains a single user-facing Bob model with a central tool policy boundary. Repository work now covers bounded tool execution, approvals, validation, cancellation, network-target checks, provider limits, bundle integrity, audio limits, webhook limits, result limits, agent-plan bounds, complete checked-in API test execution through the root test command, and production validation of the OAuth redirect base. Obsolete lockfile workflows with repository write access were removed.

Real provider checks, target hardware checks, production deployment checks, long training, and final release verification still require the actual environment, providers, hardware, credentials, or infrastructure.

Future changes must inspect main first and update roadmap.md and this handoff together. Related files may be changed in one coherent commit. Never invent files or test results.
