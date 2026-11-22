# TERIIP current scope and limitations

The TERIIP workspace interface includes a server-side, read-only Google Drive statistics reader. Reads are disabled by default and require an approved service account, least-privilege workbook shares, and institutional privacy/security approval. No fabricated participant data or workflow records are displayed.

## Available in the preview

- Centre dashboard and an administrator overview for the 16 configured centres.
- PDF review table for the complete common parameter list; values remain unavailable without a report source.
- Recent activity centre filter; history is empty until a workflow source is connected.
- Invite-only email/password sign-in and password-recovery screens, backed by the configured Supabase project.
- Separate profile and role-membership records, database access policies, and protected routes/server functions.
- Manual Drive refresh for aggregate row counts, filled-cell completeness, and file modification times; no workbook contents are returned to the browser.

## Not available yet

Account provisioning requires the new Supabase project, schema setup, and server-only service key. The PDF/CSV workflow depends on a separate local Python service and does not work from a Netlify-hosted server.

The application targets TanStack Start on Netlify with a separately managed Supabase backend. Apply the database setup and configure Auth redirects and email delivery before account creation. Obtain institutional approval for the hosting region, data handling, retention, and real-data workflows before using participant data.

## Schema note

The brief refers to 66–67 common parameters but its explicit ordered standard-column list contains 72 unique entries. The workspace preserves the explicit names and order rather than silently dropping listed fields. The two listed centre extensions (`MRD No` and `ABO & Rh Blood grouping`) are kept separate from that common schema.
