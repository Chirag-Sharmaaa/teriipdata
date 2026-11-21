# Architecture

## Current workspace

The current runnable application is a TanStack Start v1, React 19, TypeScript, and Tailwind CSS v4 frontend with Supabase Auth and database policies for account profiles, role memberships, and scoped account-audit reads. File-based routes live under `src/routes/`; the shared TERIIP workspace shell and screens are under `src/components/`. The server-side Drive statistics function uses a Google service account and fixed dataset map in `src/lib/drive-datasets.ts`; it returns only aggregate counts, filled-cell completeness, file modification times, and safe errors. Reads are disabled by default and run only on a dashboard refresh. The ordered schema and centre extensions are in `src/lib/teriip-schema.ts`. Centre selection and optional-field settings live only in React memory.

There is no PDF/OCR processor or workbook writer. The Drive reader downloads and parses each authorized workbook in server memory but does not return workbook contents or store them. Keep reads disabled until access and institutional privacy/security approval are verified.

## Production work still required

The existing application uses Supabase-backed authentication and a TanStack Start Worker frontend. Local Drive reads use direct Google Drive API access configured through server-only environment variables; they do not depend on Lovable's connector gateway. No institution-approved health-data hosting decision, PDF/OCR processor, Excel writer, secure account-provisioning lifecycle, audit-event writer, or verified retention and validation policy is implemented. Keep participant-data operations disabled until institutional approval.

## Structural decisions

- Keep participant-data workflows disabled until Drive access, account provisioning, and institutional privacy/retention requirements are verified and approved.
- Keep common parameters in their explicitly provided order and keep optional centre extensions separate. No centre assignment is inferred from its name.
- Never emulate real extraction, workbook writes, authentication, or audit persistence in browser state.
