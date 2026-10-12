# TERIIP secure Cloud foundation

## Scope

- Preserve the current TERIIP look and synthetic-only preview while adding a real, closed sign-in flow with password recovery and signed-in account controls. Keep self-registration off and require email confirmation; do not create accounts until the Super Admin and centre email roster is supplied.
- Add protected profile data for username and centre assignment, plus a separate, server-enforced role system for Super Admin, Centre Admin, and Centre Staff. Centre users must only reach their assigned centre; no role or centre privileges may be self-assigned.
- Make dashboard content follow those roles: Super Admin gets combined and selected-centre views with one selector; centre users see only their own centre; remove the redundant selector buttons and the Admin Option Fields section.
- Keep PDF and Excel confirmation actions independent. Do not enable real uploads, persistent health data, or claim Drive success until the shared Drive account, parent folder and all 16 mappings, validation/retention rules, and institutional review are verified.
- Add focused security/routing tests and a plain-language setup checklist covering the remaining account, Drive, email, and deployment actions.

## Technical details

- Use the generated Lovable Cloud auth client, TanStack Start protected-route layout and auth middleware; retain a public synthetic-only preview while production workflows remain gated.
- Add profile and role tables with explicit grants, RLS, and backend role checks. Use the role table—not profile metadata—for authorization; defer real user rows and seeded credentials.
- Verify route access, RLS boundaries, account-role rules, and the state of the PDF/Excel gates. Do not deploy for centre-wide real-data use.

## Blockers for real-data operation

- Verified Super Admin and centre user email roster.
- Authorized shared Google Drive account, TERIIP parent folder, and verified folder/workbook mapping for all 16 centres.
- Institution-approved field validation, retention/deletion, audit, and production deployment requirements.
