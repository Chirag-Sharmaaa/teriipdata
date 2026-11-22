# Data flow

## Current dashboard flow

The authenticated dashboard reads Drive data only after the user selects **Refresh now**. A server function verifies the Supabase session, active role, onboarding state, and centre scope before requesting a Google access token. It reads the configured master-tracker tab and the mapped centre workbooks with a server-only service-account key and the read-only Drive scope. Workbook rows are parsed in memory; the function returns only centre-level tracker values, row counts, age/gender totals, and safe warnings/errors. Participant rows, file contents, tokens, and private keys are never sent to the browser or saved in the database. Aggregate results are cached on the server for ten minutes; a manual refresh bypasses that cache.

Drive reads are disabled unless `TERIIP_DRIVE_READS_ENABLED=true` and both service-account settings are configured on the server. `MASTER_TRACKER_SHEET_ID` and `MASTER_TRACKER_TAB` select the master spreadsheet and worksheet. The `.env.example` setup is for local development; this reader uses the existing direct Google Drive API integration. Supabase authentication and database role checks remain the account and authorization layer. Centre accounts receive only their own centre's aggregates.

## PDF review and append flow (implemented, approval-gated)

1. An authenticated user selects a centre (Super Admin) or uses the centre assigned to the account (centre users). The server checks the role and assignment; it never trusts the browser's centre as authorization.
2. The app sends one PDF, or a CSV for P D Hinduja, to a localhost-only Python service with a shared secret. The service uses the existing extractor and sends OCR images to Tesseract via stdin/stdout.
3. Extracted values are matched by field name and returned for editing. Empty fields remain editable; unmatched extractor/page fields are listed; OCR and manual-review values are highlighted.
4. After the user confirms the displayed centre and RecordID, the server checks for a duplicate and maps reviewed values to Sheet columns by header name before appending one row.
5. Uploaded files and participant values are held in memory only; the app does not write them to its database, files, or logs. Only the destination Google Sheet receives an appended row.

The workflow requires `TERIIP_PARTICIPANT_WORKFLOW_APPROVED=true`, Drive access enabled, an active local extraction service, and the Google Sheets API enabled for the service-account project. It remains disabled by default until institutional privacy/security approval and least-privilege workbook shares are verified. No participant-level audit events are currently recorded.
