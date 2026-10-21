# Deployment status

## Current status

The workspace remains a synthetic-data demonstration. Lovable Cloud authentication settings and a protected role foundation are configured, but no TERIIP accounts have been created or assigned. The public app does not accept real reports or write to Google Drive or Excel. Do not upload real participant information or use this preview as a production system.

## Actions needed before real use

1. **Provide the verified account roster.** Supply the Super Admin's exact email and an approved list of each centre's first Centre Admin email, display name, and centre. Add staff emails later through an approved onboarding process. No addresses or temporary passwords should be invented or sent in chat. Public sign-up stays disabled.
2. **Confirm the first Super Admin bootstrap.** Approve an independently reviewed, one-time role assignment for the verified Super Admin after the account is verified. There is intentionally no public signup or self-assignment path.
3. **Verify email delivery.** Configure the institution-approved sender identity and reply-to details in Lovable Cloud's email settings, then send and receive actual verification, invitation, and password-reset messages using approved test accounts. Current delivery and reset emails have not been end-to-end tested.
4. **Authorize the shared Drive account.** In Lovable, connect the Google Drive app using an institution-authorized Google account. Complete Google's consent screen as that account, then confirm it can open the TERIIP parent folder. If access is inherited through sharing, have the institution's Drive owner grant that account the required least-privilege access. Do not paste service-account JSON, OAuth secrets, or passwords into chat or the app. The connector uses a workspace-linked account; the institution must approve that ownership and access model before relying on it.
5. **Map the 16 centre destinations.** Provide the parent folder link and a verified inventory with one row per centre: exact centre name, centre-folder link, existing workbook link, and the participant identifier/row-matching rule. Confirm the workbook's exact headers, formulas, duplicate rules, and safe handling for missing or invalid values. Verify each mapping read-only against a non-sensitive copy before any write is enabled; never infer mappings from folder names alone.
6. **Approve data handling.** Obtain institutional approval for hosting and data location, authorized roles, retention/deletion, audit fields, backups, incident response, and validation rules. Decide whether the existing Lovable Cloud runtime is an approved destination for participant health data.
7. **Complete independent review.** Test invitations, email verification, recovery, role assignment, cross-centre denial, audit outcomes, PDF processing and deletion, Excel matching/formula preservation, duplicate prevention, concurrent writes, and all explicit error states using non-sensitive test copies. Do not enable real uploads or writes until each check passes.
8. **Deploy only after approval.** Publish for centre-wide use only after the integration, email delivery, identity roster, access controls, data workflows, and institutional security/privacy review are verified.

## Available locally

For development, use `bun install` and `bun run dev`. Run checks with `bun run test` and `bun run lint`. Local development and preview are not approved for real participant data.
