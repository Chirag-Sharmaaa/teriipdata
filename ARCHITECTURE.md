# Architecture

## Current demonstration

The current runnable application is a TanStack Start v1, React 19, TypeScript, and Tailwind CSS v4 frontend with Lovable Cloud Auth and database policies for account profiles, role memberships, and scoped account-audit reads. File-based routes live under `src/routes/`; the shared TERIIP workspace shell and screens are under `src/components/`. Static synthetic metrics and activity examples are in `src/lib/teriip-demo-data.ts`. The ordered schema and centre extensions are in `src/lib/teriip-schema.ts`. Dashboard selection and remaining preview state live only in React memory.

There is no production data-processing API, OCR engine, or Drive client. No real TERIIP accounts have been provisioned, account invitation or role-change operations are disabled, and no account-audit writes are enabled. Confirm actions on the PDF and Excel screens only change the displayed synthetic demo state.

## Target described in the project brief (not implemented)

The brief calls for a Python 3.12+ FastAPI service, local PDF extraction (PyMuPDF/pdfplumber/Tesseract), Excel reading/writing, Google Drive integration, institutional authentication, isolated centre access, administrator functions, validation, and persistent audit events. These must be designed and implemented as a separately reviewed institutional service before any real-data use. The current hosted preview runtime is not that institutional Python deployment target.

## Structural decisions

- Keep participant-data workflows disabled until Drive access, account provisioning, and institutional privacy/retention requirements are verified and approved.
- Keep common parameters in their explicitly provided order and keep optional centre extensions separate. No centre assignment is inferred from its name.
- Never emulate real extraction, workbook writes, authentication, or audit persistence in browser state.
