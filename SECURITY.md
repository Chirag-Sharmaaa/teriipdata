# Security and privacy boundary

## Current workspace and account foundation

The workspace displays no fabricated participant records or workflow examples. Email/password sign-in, password recovery, profile settings, and a separate role-membership foundation are implemented. The Drive source is not connected; report uploads, OCR, workbook writes, and Drive access are not enabled. The workspace is not an approved location for participant data. Do not submit real reports, names, identifiers, or health information.

## Required before real-data use

1. Select and approve an institutional deployment environment, data controller, hosting location, and security owner.
2. Provide a verified Super Admin and centre email roster, then review and perform a one-time secure Super Admin bootstrap. Define administrator lifecycle and verify server-enforced centre isolation. Never trust a centre ID supplied by a browser.
3. Define data minimization, temporary-file handling, retention/deletion windows, backups, incident response, and audit-event contents with the institution.
4. Verify email verification, invitation, password recovery, current-password change, and sender delivery on approved test accounts. No public self-registration or plaintext email passwords.
5. Keep patient data, file contents, extracted values, and secrets out of logs, analytics, error reporting, and client telemetry.
6. Authorize the institution's shared Drive account, verify all 16 folder/workbook mappings, and review workbook concurrency, backup strategy, and least-privilege access before connecting real files.
7. Complete threat modeling, dependency review, authorization tests, security testing, and institutional approval before any production deployment.

The preview has not processed real data. Email delivery, the Super Admin bootstrap, account provisioning, Drive access, folder mapping, report extraction, workbook writes, and deployment approval remain unverified.
