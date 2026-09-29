# Code Style Guide

Standards for writing consistent, readable, and maintainable BobAI code.

## General principles

- Prefer clear, small functions with explicit inputs and outputs.
- Keep changes focused and avoid unrelated refactors.
- Follow the existing pattern in the directory before introducing a new abstraction.
- Validate external input at system boundaries.
- Prefer readable code over clever or compressed code.

## Technology and modules

- Use TypeScript for the Node.js API and web application.
- API packages use ECMAScript modules and local imports with the `.js` extension where required by the existing build.
- Keep shared database definitions in `packages/db`.
- Keep API route handlers in `apps/api/src/routes` and reusable business logic in services or stores.

## Naming

- Use PascalCase for React components and TypeScript types.
- Use camelCase for variables, functions, and object properties.
- Use UPPER_SNAKE_CASE for module-level constants where that matches surrounding code.
- Choose names that describe intent and domain meaning.

## Error handling

- Validate inputs and return controlled errors at API boundaries.
- Do not silently swallow errors unless a documented fallback is intentional.
- Do not expose secrets, stack traces, or sensitive user content in production errors.
- Preserve useful context in internal logs without logging private payloads.

## Testing

- Add tests for new behavior and regression fixes.
- Prefer Node's built-in test runner where the package already uses it.
- Cover normal behavior, invalid input, boundaries, and failure paths.
- Run the relevant workspace tests and build before opening a pull request.

## Pull requests

- Explain the behavior change and why it is needed.
- List tests actually run and any that could not be run.
- Keep migrations and configuration changes clearly identified.
- Do not claim a build or test passed unless it was run successfully.
