# Architecture

## Current demonstration

The current runnable application is a TanStack Start v1, React 19, TypeScript, and Tailwind CSS v4 frontend. File-based routes live under `src/routes/`; the shared TERIIP workspace shell and screens are under `src/components/`. Static synthetic metrics and activity examples are in `src/lib/teriip-demo-data.ts`. The ordered schema and centre extensions are in `src/lib/teriip-schema.ts`. `src/lib/teriip-demo-settings.tsx` shares only temporary in-memory demo centre and optional-field settings.

There is no production API service, identity provider, database, audit store, external AI dependency, OCR engine, or Drive client. Confirm actions only change the displayed demo state.

## Target described in the project brief (not implemented)

The brief calls for a Python 3.12+ FastAPI service, local PDF extraction (PyMuPDF/pdfplumber/Tesseract), Excel reading/writing, Google Drive integration, institutional authentication, isolated centre access, administrator functions, validation, and persistent audit events. These must be designed and implemented as a separately reviewed institutional service before any real-data use. The current hosted preview runtime is not that institutional Python deployment target.

## Structural decisions

- Keep the UI as a frontend-only demo until an approved institutional runtime and privacy/retention requirements are supplied.
- Keep common parameters in their explicitly provided order and keep optional centre extensions separate. No centre assignment is inferred from its name.
- Never emulate real extraction, workbook writes, authentication, or audit persistence in browser state.