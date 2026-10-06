# TERIIP no-Drive development build

## What to build

Replace the starter page with a professional, synthetic-data-only TERIIP workspace for the 16 configured centres. Include a centre dashboard, PDF review workflow, Excel import/mapping workflow, recent activity, and an administrator overview with centre selection. Use a restrained institutional interface that works on desktop and smaller screens.

Use the uploaded canonical parameter names and ordering, including the documented centre extensions, in one shared schema. Dashboard data and sample activity must be visibly fabricated; no participant health information is stored in browser storage or sent to any service.

## Safe local demonstration

Implement interactive preview workflows against in-memory synthetic data and a mock Drive adapter. Let staff explore review, mapping, validation, submission confirmations, charts, filters, and activity states without connecting Google Drive or implying a real write succeeded. Any selected document stays in the browser and is discarded when the workflow ends; do not retain report contents or clinical values in logs.

## Boundaries and follow-on work

The current project runs TanStack Start on a Worker, while the brief requires a local Python/FastAPI service, local OCR, SQLite/PostgreSQL, secure centre-scoped accounts, and institution-approved deployment. Do not substitute a browser-only security boundary or Lovable Cloud for that requirement. The preview build will therefore be a demonstrator, not a production system: no real-data processing, persistent health records, production authentication, OCR, or live Drive access. Clearly label the demonstration and its mock outcomes in the interface. Defer the Python service and real-data rollout until an approved deployment target and institutional security/retention decisions are available.

## Implementation details

- Replace `/` rather than adding a sibling home route; provide route-specific metadata.
- Define the semantic visual tokens in `src/styles.css`; reuse them throughout.
- Keep the canonical common and extension schema in one source module and use it for review and mapping displays.
- Keep demo state in React memory, with no localStorage persistence.
- Add focused tests for route matching and schema ordering/coverage; run the project tests and inspect the preview build logs.
- Record the no-Drive, in-memory demonstrator architecture in `AGENTS.md`.
