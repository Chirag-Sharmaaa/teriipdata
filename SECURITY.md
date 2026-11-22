# Security and privacy boundary

## Current workspace and account foundation

The workspace displays no fabricated participant records or workflow examples. Email/password sign-in, password recovery, profile settings, and a separate role-membership foundation are implemented. A server-only Google Drive dashboard reader and a local PDF/CSV review-and-append workflow are implemented, but participant processing is disabled unless `TERIIP_PARTICIPANT_WORKFLOW_APPROVED=true`. The upload is sent to a localhost Python service, processed in memory, reviewed in the browser, and appended only to the server-authorized centre Sheet. Participant rows and reports are not saved to the app database or written to application logs. The workspace is not an approved location for participant data; do not enable real-data workflows until institutional privacy/security approval is verified.

## Required before real-data use

1. Select and approve an institutional deployment environment, data controller, hosting location, and security owner.
2. Provide a verified Super Admin and centre email roster, then review and perform a one-time secure Super Admin bootstrap. Define administrator lifecycle and verify server-enforced centre isolation. Never trust a centre ID supplied by a browser.
3. Define data minimization, temporary-file handling, retention/deletion windows, backups, incident response, and audit-event contents with the institution.
4. Verify email verification, invitation, password recovery, current-password change, and sender delivery on approved test accounts. No public self-registration or plaintext email passwords.
5. Keep patient data, file contents, extracted values, and secrets out of logs, analytics, error reporting, and client telemetry.
6. Create an institution-approved Google service account, verify all 16 destination mappings and the configured master-tracker sheet/tab, and share only the 16 centre Sheets with **Editor** and the Master Tracker with **Viewer**. Enable the Google Sheets API in the service-account project. Do not grant the service account access to the parent folder containing participant PDFs.
7. Complete threat modeling, dependency review, authorization tests, security testing, and institutional approval before any production deployment.

Email delivery, the Super Admin bootstrap, account provisioning, Google Sheets API enablement, report extraction against real reports, workbook writes, institutional approval, and deployment approval remain unverified. Keep `TERIIP_PARTICIPANT_WORKFLOW_APPROVED=false` until the required review is complete. Keep Drive reads disabled until their review is complete as well.
