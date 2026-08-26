# Bob Coding Agents integration

BobAI is the only user-facing agent. Bob Coding Agents runs as a localhost background worker service and is contacted over its authenticated HTTP API.

## Local setup

1. In `Bob-Coding-Agents`, create `.env` from `.env.example`.
2. Set `WORKSPACE_DIR` to the local BobAI repository root.
3. Set a random secret of at least 32 characters for `BOBAI_AGENT_API_KEY`.
4. Start the worker API with `npm run agent-api`.
5. In BobAI's `apps/api/.env`, set `BOBAI_CODING_AGENT_URL=http://127.0.0.1:3456` and set `BOBAI_CODING_AGENT_KEY` to the same secret.
6. Start BobAI normally.

Coding requests from BobAI are queued and sent to the worker only when a local worker slot is available. The worker is bound to loopback and does not expose its API publicly.

## Security boundary

The BobAI bridge only accepts localhost coding-agent URLs. The coding-agent API requires a bearer secret and is also bound to `127.0.0.1`. Never commit either secret or a real `.env` file.

## Workspace boundary

`WORKSPACE_DIR` controls exactly which local repository the coding agents can modify. Point it at the BobAI checkout you intend to automate; do not point it at a parent directory containing unrelated personal files.
