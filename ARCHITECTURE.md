# Architecture

## Current workspace

The current runnable application is a TanStack Start v1, React 19, TypeScript, and Tailwind CSS v4 frontend with Lovable Cloud Auth and database policies for account profiles, role memberships, and scoped account-audit reads. File-based routes live under `src/routes/`; the shared TERIIP workspace shell and screens are under `src/components/`. There are no fabricated participant records, activity rows, report values, or workbook rows. While Drive is disconnected, data metrics show zero or unavailable and data-dependent views show empty states. The ordered schema and centre extensions are in `src/lib/teriip-schema.ts`. Centre selection and optional-field settings live only in React memory.

There is no production data-processing API, OCR engine, or Drive client. No real participant processing or Drive writes are enabled. The PDF-review and Excel-import screens do not accept data or report simulated success.

## Production work still required

The current project target is Lovable Cloud for managed authentication and backend data, with the existing TanStack Start Worker frontend. This is not a local Python/FastAPI processing service. No Drive connector, institution-approved health-data hosting decision, PDF/OCR processor, Excel writer, secure account-provisioning lifecycle, audit-event writer, or verified retention and validation policy is implemented. Build and independently review these before any real-data use; keep participant-data operations disabled until institutional approval.

## Structural decisions

- Keep participant-data workflows disabled until Drive access, account provisioning, and institutional privacy/retention requirements are verified and approved.
- Keep common parameters in their explicitly provided order and keep optional centre extensions separate. No centre assignment is inferred from its name.
- Never emulate real extraction, workbook writes, authentication, or audit persistence in browser state.
