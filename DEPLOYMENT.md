# Deployment status

## Current status

The workspace displays no fabricated participant data. A server-side, read-only Google Drive statistics reader is implemented but disabled by default; report processing, workbook writes, and production real-data workflows are not enabled. Do not upload real participant information or enable Drive reads before institutional approval.

## Actions needed before real use

1. **Provide the verified account roster.** Supply the Super Admin's exact email and an approved list of each centre's first Centre Admin email, display name, and centre. Add staff emails later through an approved onboarding process. No addresses or temporary passwords should be invented or sent in chat. Public sign-up stays disabled.
2. **Confirm the first Super Admin bootstrap.** Approve an independently reviewed, one-time role assignment for the verified Super Admin after the account is verified. There is intentionally no public signup or self-assignment path.
3. **Configure and test email.** In the project's Lovable Cloud authentication/email settings, retain email confirmation and closed public sign-up. Set the institution-approved sender name, sender address, and reply-to address. If using an institutional sending domain, have its DNS administrator add the exact domain-verification and mail-authentication records shown by the email service, then wait for verification to pass. Review the confirmation, invitation, and password-reset message templates and redirect links. Send and receive all three message types with approved test accounts, including a completed reset. Actual delivery has not yet been tested.
4. **Configure direct read-only Drive access.** In Google Cloud Console, enable the Google Drive API, create a service account, and create a JSON key. Add its `client_email` and `private_key` to the server-only variables in `.env.local` using `.env.example`. Set `MASTER_TRACKER_SHEET_ID` and `MASTER_TRACKER_TAB` to the approved tracker spreadsheet and exact tab. Share only the 16 mapped destination workbooks and that master tracker with the service-account email as Viewer; do not share the parent reports folder containing PDFs. Never commit or send the JSON key.
5. **Verify the 16 centre destinations and tracker mapping.** Confirm the configured master tab contains one row per centre and the expected headers, then verify every existing workbook mapping and its participant-ID header. Test read-only with a non-sensitive copy before any write is enabled; never infer mappings from folder names alone.
6. **Approve data handling.** Obtain institutional approval for hosting and data location, authorized roles, retention/deletion, audit fields, backups, incident response, and validation rules. Decide whether the existing Lovable Cloud runtime is an approved destination for participant health data.
7. **Complete independent review.** Test invitations, email verification, recovery, role assignment, cross-centre denial, audit outcomes, PDF processing and deletion, Excel matching/formula preservation, duplicate prevention, concurrent writes, and all explicit error states using non-sensitive test copies. Confirm server/database controls rather than relying on hidden screens. Do not enable real uploads or writes until each check passes.
8. **Deploy only after approval.** Publish for centre-wide use only after the integration, email delivery, identity roster, access controls, data workflows, and institutional security/privacy review are verified.

## Available locally

For local development, configure `.env.local`, then use `npm install`, `npm run dev`, and `npm test` (or the matching Bun commands). Drive reads remain disabled until `TERIIP_DRIVE_READS_ENABLED=true`; set it only after the access and privacy/security review is approved. Local development and preview are not otherwise approved for real participant data.
