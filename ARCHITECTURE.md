# Architecture

## Current demonstration

The current runnable application is a TanStack Start v1, React 19, TypeScript, and Tailwind CSS v4 frontend with Lovable Cloud Auth and database policies for account profiles, role memberships, and scoped account-audit reads. File-based routes live under `src/routes/`; the shared TERIIP workspace shell and screens are under `src/components/`. Static synthetic metrics and activity examples are in `src/lib/teriip-demo-data.ts`. The ordered schema and centre extensions are in `src/lib/teriip-schema.ts`. Dashboard selection and remaining preview state live only in React memory.

There is no production data-processing API, OCR engine, or Drive client. No real TERIIP accounts have been provisioned, account invitation or role-change operations are disabled, and no account-audit writes are enabled. Confirm actions on the PDF and Excel screens only change the displayed synthetic demo state.

## Production work still required

The current project target is Lovable Cloud for managed authentication and backend data, with the existing TanStack Start Worker frontend. This is not a local Python/FastAPI processing service. No Drive connector, institution-approved health-data hosting decision, PDF/OCR processor, Excel writer, secure account-provisioning lifecycle, audit-event writer, or verified retention and validation policy is implemented. Build and independently review these before any real-data use; keep participant-data operations disabled until institutional approval.

## Structural decisions

- Keep participant-data workflows disabled until Drive access, account provisioning, and institutional privacy/retention requirements are verified and approved.
- Keep common parameters in their explicitly provided order and keep optional centre extensions separate. No centre assignment is inferred from its name.
- Never emulate real extraction, workbook writes, authentication, or audit persistence in browser state.
