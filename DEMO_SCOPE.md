# TERIIP current scope and limitations

The TERIIP workspace interface includes a server-side, read-only Google Drive statistics reader. Reads are disabled by default and require an approved service account, least-privilege workbook shares, and institutional privacy/security approval. No fabricated participant data or workflow records are displayed.

## Available in the preview

- Centre dashboard and an administrator overview for the 16 configured centres.
- PDF review table for the complete common parameter list; values remain unavailable without a report source.
- Recent activity centre filter; history is empty until a workflow source is connected.
- Invite-only email/password sign-in and password-recovery screens, backed by Lovable Cloud Auth.
- Separate profile and role-membership records, database access policies, and protected routes/server functions.
- Manual Drive refresh for aggregate row counts, filled-cell completeness, and file modification times; no workbook contents are returned to the browser.

## Not available yet

No TERIIP accounts or role assignments have been provisioned. Secure account invitations and account changes remain paused; the protected team view can only list accounts that an authenticated administrator is authorized to see. There is no PDF parsing, local OCR, actual file upload, workbook writing, or verified production email delivery. A protected account-audit table exists, but account changes are not enabled and no audit writes are currently produced. The preview is not approved for participant data. Keep Drive reads disabled until institutional approval is verified.

Production work is not complete in this preview. The current application template runs TanStack Start on a Worker with Lovable Cloud authentication and database policies; it is not a local Python/FastAPI processing service. Implementing real-data functions requires a confirmed hosting/privacy decision, verified Drive account and destination mappings, approved retention and validation rules, secure account provisioning and audit writes, plus deployment/security review.

## Schema note

The brief refers to 66–67 common parameters but its explicit ordered standard-column list contains 72 unique entries. The workspace preserves the explicit names and order rather than silently dropping listed fields. The two listed centre extensions (`MRD No` and `ABO & Rh Blood grouping`) are kept separate from that common schema.
