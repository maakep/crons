# AI Contributor Guide

Read `ARCHITECTURE.md` first. It covers directory structure, design principles, and conventions.
This file covers how to implement features correctly.

## Before Writing Code

1. Read `ARCHITECTURE.md` to understand the layering and principles.
2. Check `lib/` for existing utilities — never reimplement what already exists.
3. Check `config/` for existing patterns — match the style of existing config files.

## Implementing a New Cron Job

Every job requires exactly three files, all sharing the same `<name>`:

### 1. `config/<name>.json`
- All static data, messages, URLs (non-secret), thresholds, flags
- This is where behavior is configured — not in code
- Keep it flat when possible; nest only when it genuinely aids clarity

### 2. `jobs/<name>.mjs`
- Must use `runJob()` from `lib/run.mjs`
- Must declare `requiredFields` for all config fields the job depends on
- Should be under 10 lines — just glue between config and lib
- Template:
```js
import { runJob } from "../lib/run.mjs";
import { someHelper } from "../lib/some-helper.mjs";

await runJob("<name>", async (config) => {
  await someHelper(config.someValue);
}, { requiredFields: ["someValue"] });
```

### 3. `.github/workflows/<name>.yml`
- Cron schedule + `workflow_dispatch` (always include for manual testing)
- Single step: `actions/checkout@v4` then `node jobs/<name>.mjs`
- Pass secrets via `env:` — never hardcode them
- Template:
```yaml
name: Descriptive Name
on:
  schedule:
    - cron: "..."
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node jobs/<name>.mjs
        env:
          SECRET_NAME: ${{ secrets.SECRET_NAME }}
```

### 4. Update docs
- Add new secrets to `.env.example` and the secrets registry in `ARCHITECTURE.md`
- If you added a new `lib/` module, update the lib table in `ARCHITECTURE.md`

## Implementing a New Library Module

- Create `lib/<name>.mjs`
- Build on existing utilities — use `lib/fetch.mjs` for HTTP, `lib/env.mjs` for secrets
- Never read `process.env` directly for secrets — always go through `requireEnv()`
- Export focused, single-purpose functions
- Update the lib table in `ARCHITECTURE.md`

## Code Style

- **No unnecessary comments.** The code should be self-explanatory. Only comment the *why* when it's genuinely non-obvious.
- **No JSDoc blocks** unless the function signature is truly ambiguous. Function names and parameters should communicate intent.
- **Native ESM only.** All files use `.mjs`. No CommonJS, no transpilation.
- **No external dependencies** unless absolutely necessary. Prefer native Node.js APIs (`fetch`, `fs`, `crypto`, `URL`, etc.). If a dependency is truly needed, document why.
- **No build step.** Everything runs directly with `node`.

## Data-Driven Design

This is the most important principle. When adding features:

- **Put data in config, logic in lib, glue in jobs.** If you're hardcoding a string, URL, threshold, or list in a `.mjs` file, it probably belongs in `config/`.
- **Make it easy to change behavior without changing code.** A non-developer should be able to modify `config/*.json` and change what the system does.
- **Config is the interface.** Think of each job's JSON as the "API" that controls its behavior.

## Security Rules

- Secrets go in GitHub Actions secrets, never in code or config files.
- Always read secrets through `lib/env.mjs` (`requireEnv()`).
- Never log secret values. Use `redact()` if partial values are needed for debugging.
- Never pass secret values into error messages.

## Common Mistakes to Avoid

- Putting logic directly in `jobs/` files instead of `lib/`
- Hardcoding values that belong in config
- Reading `process.env` directly instead of using `requireEnv()`
- Adding comments that restate what the code does
- Forgetting `workflow_dispatch` in workflow files
- Forgetting to update `ARCHITECTURE.md` when adding new lib modules or secrets
- Forgetting `requiredFields` when calling `runJob()`
