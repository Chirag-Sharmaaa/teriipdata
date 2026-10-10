# TERIIP Research Workspace — demonstration

This project currently contains a **synthetic-data-only interactive preview** of a proposed multi-centre TERIIP research workspace. It is not the production data-processing system described in the uploaded brief. Do not enter real participant information or upload real reports.

## Run locally

Requires Bun and a current supported Node.js version for the development toolchain.

```sh
bun install
bun run dev
```

Open the local address printed by Vite. Run available checks with `bun run test` and `bun run lint`.

## Preview screens

- `/` — synthetic centre dashboard and recent activity.
- `/upload` — editable fabricated PDF-review example; no file chooser or PDF processing.
- `/import` — fabricated spreadsheet column mapping; no workbook upload or import.
- `/activity` — synthetic activity examples and centre filter.
- `/admin` — synthetic centre summaries and optional-field settings.

All preview state is temporary React in-memory state. Refreshing resets changes. Drive status, data, and successful confirmations are examples only.

## Read next

- [Architecture](ARCHITECTURE.md)
- [Security and privacy boundary](SECURITY.md)
- [Data flow](DATA_FLOW.md)
- [Parameter schema](PARAMETER_SCHEMA.md)
- [Deployment status](DEPLOYMENT.md)
- [Testing](TESTING.md)
- [Demo scope and limitations](DEMO_SCOPE.md)
