# TERIIP demonstration scope

This project currently provides an interactive, synthetic-data-only preview of the proposed TERIIP workspace. Dashboard totals, charts, record identifiers, activity, report fields, and spreadsheet examples are fabricated.

## Available in the preview

- Centre dashboard and an all-centre administrator overview for the 16 named centres.
- Editable review-table example for the complete common parameter list.
- Spreadsheet column-mapping example with synthetic rows.
- Recent activity filters and status examples.
- Invite-only email/password sign-in and password-recovery screens, backed by Lovable Cloud Auth.
- Separate profile and role-membership records, database access policies, and protected routes/server functions.
- Mock Drive connection status, with no reads, uploads, or writes.

## Not available yet

No TERIIP accounts or role assignments have been provisioned. Secure account invitations and account changes remain paused; the protected team view can only list accounts that an authenticated administrator is authorized to see. There is no PDF parsing, local OCR, actual file upload, spreadsheet parser, workbook writing, Google Drive connection, or verified production email delivery. A protected account-audit table exists, but account changes are not enabled and no audit writes are currently produced. The preview does not provide a secure place to enter real participant information. Do not upload, paste, or enter real reports or participant data.

The uploaded brief requests a local Python/FastAPI service and institution-approved deployment. The current application template runs TanStack Start on a Worker, so this preview does not substitute browser-only logic or Lovable Cloud for the requested local processing/security boundary. Implementing real-data functions requires a separately approved institutional runtime, retention policy, access-control design, and deployment/security review.

## Schema note

The brief refers to 66–67 common parameters but its explicit ordered standard-column list contains 72 unique entries. The demo preserves the explicit names and order rather than silently dropping listed fields. The two listed centre extensions (`MRD No` and `ABO & Rh Blood grouping`) are kept separate from that common schema.
