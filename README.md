# TERIIP Research Workspace

This project contains the TERIIP workspace interface and Lovable Cloud sign-in and role foundation. The Google Drive source is not connected, so the workspace displays no participant records, activity, report values, or workbook rows. The screens remain in place, but report extraction, workbook import/writes, and Drive operations are not configured. Do not enter real participant information or upload real reports.

## Run locally

Requires Bun and a current supported Node.js version for the development toolchain.

```sh
bun install
bun run dev
```

Open the local address printed by Vite. Run available checks with `bun run test` and `bun run lint`.

## Workspace screens

- `/` — centre dashboard with zero records and unavailable completeness while no data source is connected.
- `/upload` — empty PDF-review fields; no file chooser or PDF processing is configured.
- `/import` — empty column-mapping and workbook preview states; no workbook source is connected.
- `/activity` — empty workflow history with centre filter.
- `/admin` — configured centre list with zero records and unavailable completeness.
- `/auth` — invite-only sign-in and password recovery.
- `/reset-password` — password reset for valid recovery links.
- `/settings` — signed-in profile and password settings.
- `/manage-users` — protected, scope-limited account listing; changes are paused until secure provisioning is configured.

Centre selection and optional-field settings are temporary React in-memory state. No fabricated participant or workflow data is used. Real-data workflows remain disabled until Drive configuration and institutional privacy/security approvals are verified.

## Read next

- [Architecture](ARCHITECTURE.md)
- [Security and privacy boundary](SECURITY.md)
- [Data flow](DATA_FLOW.md)
- [Parameter schema](PARAMETER_SCHEMA.md)
- [Deployment status](DEPLOYMENT.md)
- [Testing](TESTING.md)
- [Current scope and limitations](DEMO_SCOPE.md)
