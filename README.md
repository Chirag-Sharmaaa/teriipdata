# TERIIP Research Workspace — demonstration

This project contains a **synthetic-data-only interactive preview** of the proposed multi-centre TERIIP research workspace, plus a Lovable Cloud sign-in and protected role foundation. It is not the production data-processing system described in the uploaded brief. No users have been provisioned and no real participant processing or Drive writes are enabled. Do not enter real participant information or upload real reports.

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
- `/admin` — synthetic centre summaries; the former optional-field settings panel has been removed.
- `/auth` — invite-only sign-in and password recovery.
- `/reset-password` — password reset for valid recovery links.
- `/settings` — signed-in profile and password settings.
- `/manage-users` — protected, scope-limited account listing; changes are paused until secure provisioning is configured.

All preview state is temporary React in-memory state. Refreshing resets changes. Drive status, data, and successful confirmations are examples only.

## Read next

- [Architecture](ARCHITECTURE.md)
- [Security and privacy boundary](SECURITY.md)
- [Data flow](DATA_FLOW.md)
- [Parameter schema](PARAMETER_SCHEMA.md)
- [Deployment status](DEPLOYMENT.md)
- [Testing](TESTING.md)
- [Demo scope and limitations](DEMO_SCOPE.md)
