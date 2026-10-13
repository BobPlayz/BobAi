# AI Spects + BobAI repository consolidation audit

## Scope and current state

This is the proposed merge plan for bringing the complete AI-Glasses repository into BobAI without replacing BobAI's existing application. The intended subtree path is `integrations/ai-spects/`.

**Important:** a subtree import preserves source code in one repository; it does not automatically connect the Python application to BobAI's chat UI. Runtime integration must be done as a separate, tested step.

## BobAI audit

- Root npm workspace includes `apps/*` and `packages/*`.
- Frontend: Next.js 16 / React 19 at `apps/web`.
- Chat page exists at `apps/web/src/app/chat/page.tsx`, using BobAI's own conversation hook, sidebar, composer, and chat components.
- API: TypeScript + Express 5 at `apps/api`.
- Database package: Drizzle/PostgreSQL at `packages/db`.
- Existing build/test scripts and multiple API/security test suites exist.
- Root scripts and lockfile should remain authoritative; do not replace them with AI Spects' Python requirements or scripts.

## AI Spects audit

- Python 3.11 FastAPI application launched as `laptop.app:app`.
- Local Ollama text/vision adapters, faster-whisper speech recognition, Piper/edge-tts speech, Tesseract OCR, local memory, and a dark/cyan dashboard.
- Device pairing, privacy-gated camera/microphone paths, and candidate ESP32-S3 firmware.
- Includes PowerShell setup/launch scripts, Python tests, documentation, and firmware build workflow.
- README/status docs explicitly say physical hardware and glasses-speaker operation are not verified by software tests alone.

## Recommended repository layout

```text
BobAi/
  apps/
    web/                 # existing BobAI Next.js chat website
    api/                 # existing BobAI TypeScript API
    bobhs/               # existing service
  packages/
    db/                  # existing database package
  integrations/
    ai-spects/           # complete imported AI Spects source tree
      laptop/
      firmware/
      tests/
      docs/
      setup.ps1
      requirements.txt
  docs/
    AI_SPECTS_REPOSITORY_MERGE.md
```

## Clean merge rules

1. Import AI Spects as a subtree, preserving its history and all original relative paths.
2. Do not overwrite root `README.md`, `.gitignore`, `package.json`, lockfiles, or `.github/workflows` from either repository.
3. Exclude no source code or tests silently. If a binary fixture is not imported, record it and explain why.
4. Keep Python and Node dependencies separate. Do not try to install `requirements.txt` through npm.
5. The nested `.github/workflows` files are preserved for reference, but GitHub Actions only discovers workflows under the repository-root `.github/workflows`. Add deliberate root-level workflows later if desired.
6. Keep hardware firmware optional. The website should still run without an ESP32 board connected.
7. Do not expose local-only device/camera endpoints publicly without an authenticated, reviewed API boundary.

## Post-merge verification gate

Run BobAI checks from the root:
- `npm ci`
- `npm run build`
- `npm test`

Run AI Spects checks from its imported directory:
- Create its Python 3.11 virtual environment there.
- Install `requirements.txt`.
- Run `python -m compileall laptop tests`.
- Run `python -m unittest discover -s tests -v`.

Then review the diff, check for secrets/generated files, and test the website and Python service independently. Do not claim the features are integrated or hardware-verified until the appropriate tests and real-device checks pass.

## Integration follow-up

Use BobAI's existing chat page as the primary web experience. Decide which AI Spects capabilities should be exposed through a dedicated local service/API, then connect them through explicit API contracts. Avoid maintaining two separate chat histories and two unrelated UI entry points unless that is an intentional product decision.

## Rollback

The work is being staged on `integration/ai-spects-monorepo`. Keep `main` unchanged until the imported subtree, builds, and tests have been reviewed. Keep the original `Ai-Glasses` repository intact until the merge is accepted.
