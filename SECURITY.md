# Security and privacy boundary

## Current preview

This preview has no authentication, authorization, server-side centre isolation, persistence, upload endpoint, PDF/OCR processing, or Google Drive connection. Synthetic examples are fabricated, public UI data. In-memory UI state is not a security control. Do not submit real reports, names, identifiers, or health information.

## Required before real-data use

1. Select and approve an institutional deployment environment, data controller, hosting location, and security owner.
2. Define access roles, centre membership, administrator lifecycle, and server-enforced centre isolation. Never trust a centre ID supplied by a browser.
3. Define data minimization, temporary-file handling, retention/deletion windows, backups, incident response, and audit-event contents with the institution.
4. Use institutional authentication and protect credentials in managed secrets. No public self-registration or plaintext email passwords.
5. Keep patient data, file contents, extracted values, and secrets out of logs, analytics, error reporting, and client telemetry.
6. Review OAuth/service-account permissions, Drive folder IDs, workbook concurrency/backup strategy, and least-privilege access before connecting a real Drive.
7. Complete threat modeling, dependency review, authorization tests, security testing, and institutional approval before any production deployment.

No item in this checklist is represented as completed by the demo.