# Architecture

Scheduled cron jobs running via GitHub Actions.
Lightweight Node.js scripts — no build step, no bundler, zero external dependencies by default.

## Directory Structure

```
├── .github/workflows/   # One minimal workflow YAML per cron job
├── config/              # Static config/data per job (JSON)
├── jobs/                # Thin entry points (one per cron job)
├── lib/                 # Shared reusable utilities
├── run.mjs              # Local test runner (loads .env, runs a job by name)
├── .env.example         # Documents all required secrets
├── AGENTS.md            # Instructions for AI contributors
└── ARCHITECTURE.md      # This file
```

## Layers

| Layer | Contains | Example |
|---|---|---|
| `config/*.json` | Static data — messages, thresholds, feature flags, non-secret URLs | `{"message": "hello world"}` |
| `jobs/*.mjs` | Glue — run job, call lib functions | `runJob("x", async (config) => { ... })` |
| `lib/*.mjs` | Reusable logic — HTTP, integrations, env reading | `fetch.mjs`, `slack.mjs`, `run.mjs` |
| GitHub Secrets | Sensitive values only — API keys, tokens | `SLACK_BOT_TOKEN` |

Config drives behavior. Change what a job does by editing its JSON, not its code.

## `config/`

One JSON file per job, matching the job filename: `config/hello-world.json` <-> `jobs/hello-world.mjs`.

Global settings live in `config/settings.json` (e.g. `errorChannel` for error notifications). Job-specific configs include a `slackChannel` field to control where messages are posted.

Config is loaded and validated automatically by `runJob`:
```js
await runJob("hello-world", async (config) => {
  // config is already loaded and validated
}, { requiredFields: ["message"] });
```

## `jobs/`

Thin entry points. Each job should:
- Be an `.mjs` file (native ESM)
- Use `runJob()` from `lib/run.mjs` — this handles config loading, logging, timing, and error notification
- Declare `requiredFields` for config validation
- Stay under ~10 lines

Naming matches workflow: `jobs/foo-bar.mjs` <-> `.github/workflows/foo-bar.yml`.

## `lib/`

| Module       | Purpose                                              |
|--------------|------------------------------------------------------|
| `run.mjs`         | Job runner — config loading, logging, timing, error notification |
| `config.mjs`      | Load and validate a job's JSON config                |
| `env.mjs`         | Read/validate env vars, redact secrets for logs      |
| `fetch.mjs`       | HTTP client with retries, timeouts, error types      |
| `slack.mjs`       | Slack Web API — text and Block Kit messages (chat.postMessage) |
| `chart.mjs`       | Build QuickChart.io URLs/short URLs from Chart.js configs |
| `electricity.mjs` | Fetch SE spot prices, analyze, build price chart configs |

New integrations get a new module in `lib/`.

## `.github/workflows/`

Minimal template:

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

No `npm install`. No build. Just checkout and run.

## Design Principles

1. **Data-driven.** Separate config/data from logic. Jobs read their behavior from `config/*.json`. Changing what a job does should rarely require changing code.
2. **Zero dependencies.** Use native Node.js APIs (`fetch`, `fs`, `crypto`). Only add npm packages when truly necessary.
3. **DRY.** All reusable logic lives in `lib/`. Never duplicate across jobs.
4. **Jobs are thin.** Use `runJob()`, call library functions, done.
5. **Clean code.** Code should be self-explanatory. Avoid comments that restate what the code does. Only comment the *why* when it's non-obvious.
6. **Fail fast.** Missing env vars, bad responses, unexpected states — throw immediately.
7. **Never log secrets.** Use `lib/env.mjs` for secret access. Use `redact()` for debug output.
8. **One workflow per job.** Keep workflows independent.
9. **Consistent naming.** `config/x.json` <-> `jobs/x.mjs` <-> `.github/workflows/x.yml`.

## Security

- Secrets live in GitHub Actions secrets, passed via `env:` in workflow YAML. Never committed.
- `lib/env.mjs` is the single point of secret access.
- `.gitignore` blocks `.env` files and `node_modules/`.
- Error messages never include secret values.

## External Services

| Service | Used by | Purpose | Auth |
|---|---|---|---|
| elprisetjustnu.se | `electricity.mjs` | Swedish spot electricity prices (SE1-SE4) | None (free, open) |
| QuickChart.io | `chart.mjs` | Render Chart.js configs to PNG images via URL | None (free tier) |

## Secrets Registry

All secrets used in this repo. Add new entries here when introducing new secrets.

| Secret | Used by | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | All Slack jobs | Slack bot token (`xoxb-...`) for the Web API |

See `.env.example` for the full list in a copy-pasteable format.

## Local Testing

```sh
# 1. Copy .env.example and fill in real values
cp .env.example .env

# 2. Run any job by name
node run.mjs hello-world
node run.mjs electricity-prices
```

`run.mjs` loads `.env` automatically, validates the job exists, and runs it. This is the same code path as CI — no special setup needed beyond the `.env` file.

## Slack Setup

This repo uses the Slack Web API (not webhooks). A Slack app manifest is provided in `slack-app-manifest.yml` for easy setup:

1. Create a Slack app from the manifest at https://api.slack.com/apps
2. Install the app to your workspace
3. Copy the bot token (`xoxb-...`) to `SLACK_BOT_TOKEN` in GitHub Actions secrets
4. Invite the bot to each channel it posts to (`/invite @Cron Notifications`)

The bot requires the `chat:write` scope (already configured in the manifest).

## Adding a New Cron Job

1. Create `config/<name>.json` with the job's data/settings.
2. Create `jobs/<name>.mjs` — use `runJob()`, declare `requiredFields`, call lib functions.
3. Create `.github/workflows/<name>.yml` — cron, `workflow_dispatch`, checkout, run.
4. Add any new secrets in GitHub repo settings, `.env.example`, and the secrets registry above.

## Adding a New Library Module

1. Create `lib/<name>.mjs`.
2. Build on existing utilities (`fetch.mjs`, `env.mjs`) rather than reimplementing.
3. Export focused functions.
4. Update the lib table above.
