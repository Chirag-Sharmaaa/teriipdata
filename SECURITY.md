# Security and privacy boundary

## Current workspace and account foundation

The workspace displays no fabricated participant records or workflow examples. Email/password sign-in, password recovery, profile settings, and a separate role-membership foundation are implemented. A server-only, read-only Google Drive dashboard reader is implemented but disabled by default. It temporarily reads authorized workbook bytes to calculate tracker counts and demographic aggregates; only aggregated values are returned, and participant rows are not saved to the database. Report uploads, OCR, and workbook writes are not enabled. The workspace is not an approved location for participant data. Do not enable real Drive reads until institutional privacy/security approval is verified.

## Required before real-data use

1. Select and approve an institutional deployment environment, data controller, hosting location, and security owner.
2. Provide a verified Super Admin and centre email roster, then review and perform a one-time secure Super Admin bootstrap. Define administrator lifecycle and verify server-enforced centre isolation. Never trust a centre ID supplied by a browser.
3. Define data minimization, temporary-file handling, retention/deletion windows, backups, incident response, and audit-event contents with the institution.
4. Verify email verification, invitation, password recovery, current-password change, and sender delivery on approved test accounts. No public self-registration or plaintext email passwords.
5. Keep patient data, file contents, extracted values, and secrets out of logs, analytics, error reporting, and client telemetry.
6. Create an institution-approved, read-only Google service account, verify all 16 workbook mappings and the configured master-tracker sheet/tab, and share only those 17 spreadsheets with it. Do not grant the service account access to the parent folder containing participant PDFs.
7. Complete threat modeling, dependency review, authorization tests, security testing, and institutional approval before any production deployment.

Email delivery, the Super Admin bootstrap, account provisioning, Google service-account setup, workbook permissions, report extraction, workbook writes, and deployment approval remain unverified. Keep `TERIIP_DRIVE_READS_ENABLED=false` until the required review is complete.
