# Architecture

## Current workspace

The runnable application is a TanStack Start v1, React 19, TypeScript, and Tailwind CSS v4 app configured for Netlify, with independently managed Supabase Auth and Postgres policies for profiles, role memberships, and account-audit reads. File-based routes live under `src/routes/`; shared screens live under `src/components/`. The Google Drive statistics function uses a server-only service account and fixed dataset map in `src/lib/drive-datasets.ts`; it returns aggregate counts and safe errors. Centre selection and optional-field settings live only in React memory.

PDF/CSV processing runs through the separate localhost Python service. Netlify cannot reach that service on a user's computer. The Drive reader and sheet writer run server-side; neither should return participant rows to browser UI except the explicit reviewed row workflow. Keep real-data use subject to institutional approval.

## Production work still required

The app's authentication, role checks, and server functions depend on Supabase configuration and the SQL schema in `supabase/OWN_SUPABASE_SETUP.sql`. Google Drive reads/writes use separate server-only credentials. See `OWN_SUPABASE_SETUP.md` for migration and deployment setup.

## Structural decisions

- Keep participant-data workflows disabled until Drive access, account provisioning, and institutional privacy/retention requirements are verified and approved.
- Keep common parameters in their explicitly provided order and keep optional centre extensions separate. No centre assignment is inferred from its name.
- Never emulate real extraction, workbook writes, authentication, or audit persistence in browser state.
