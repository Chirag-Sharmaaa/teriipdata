# TERIIP workspace roadmap

- [x] Build the dashboard, PDF-review, spreadsheet-mapping, activity, and administrator views.
- [x] Remove fabricated participant and workflow values; show empty or unavailable states while approved data sources are not connected.
- [x] Centralize the explicit 72-name common schema and keep two optional extensions separate.
- [x] Add temporary centre-specific extension toggles and document the prototype boundary.
- [x] Add project, architecture, privacy, data-flow, schema, deployment, and testing documentation.
- [x] Add the invite-only sign-in and password recovery screens, profile settings, separate role memberships, role-aware dashboard, scoped account listing foundation, and remove the optional-fields panel. Configure public signup as disabled and confirm route/schema/access helper tests.
- [x] Create 2 Super Admin and 16 Centre Admin accounts with one-time temporary logins and a forced first-login flow (add + confirm email, then choose own password); enable server-checked invite/edit/disable/delete in Team accounts with audit records; put every workspace page behind sign-in.
- [ ] Verify the emailed confirmation and invitation links end to end on the live site. Blocker: first real sign-in by an account holder.
- [ ] Port each centre's Python extraction logic into the app. Blocker: the user's per-centre Python files and one sample report per centre.
- [ ] Confirm the discrepancy between the stated 66–67 parameters and the 72 explicit names with the TERIIP data owner. Blocker: institutional confirmation.
- [ ] Define institutional hosting, authentication, centre isolation, retention, validation, and audit policies. Blocker: institutional decisions and approval.
- [ ] Implement and test the approved report processing, workbook updates, and Google Drive integration. Blocker: verified parent folder access, all 16 folder/workbook mappings, approved processing/deployment target, and institutional permissions.