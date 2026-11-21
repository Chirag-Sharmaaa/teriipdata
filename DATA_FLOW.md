# Data flow

## Current dashboard flow

The authenticated dashboard reads Drive data only after the user selects **Refresh now**. A server function verifies the Supabase session, active role, onboarding state, and centre scope before requesting a Google access token. It reads the configured master-tracker tab and the mapped centre workbooks with a server-only service-account key and the read-only Drive scope. Workbook rows are parsed in memory; the function returns only centre-level tracker values, row counts, age/gender totals, and safe warnings/errors. Participant rows, file contents, tokens, and private keys are never sent to the browser or saved in the database. Aggregate results are cached on the server for ten minutes; a manual refresh bypasses that cache.

Drive reads are disabled unless `TERIIP_DRIVE_READS_ENABLED=true` and both service-account settings are configured on the server. `MASTER_TRACKER_SHEET_ID` and `MASTER_TRACKER_TAB` select the master spreadsheet and worksheet. The `.env.example` setup is for local development; this reader uses the existing direct Google Drive API integration. Supabase authentication and database role checks remain the account and authorization layer. Centre accounts receive only their own centre's aggregates.

## Intended future flow (not implemented)

1. An authenticated user submits one PDF or workbook to an institution-approved service.
2. The service verifies the caller and centre authorization itself, validates file type/size, and processes data locally using approved tools.
3. Extracted values are shown for manual verification; validation rules are supplied and approved by the institution.
4. After explicit confirmation, the service writes only to the authorized centre destination using approved Drive permissions.
5. A privacy-reviewed audit event records necessary workflow metadata without copying health values into logs.
6. Temporary files are removed according to the approved retention policy; failures do not report a successful write.

PDF upload, extraction, destination workbook writes, and audit events for data operations are not implemented. Do not enable real Drive reads until institutional privacy/security approval and the least-privilege workbook shares are verified.
