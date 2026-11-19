# Data flow

## Current application flow

No fabricated participant values or workflow records are displayed. Because Drive is not connected, the dashboard reports zero records, completeness is unavailable, and report-review, workbook-mapping, activity, and data-dependent admin panels show empty states. These screens do not read files, submit participant data, or simulate successful writes. Authentication uses Lovable Cloud Auth; role membership and profile attributes are separate, and protected database policies scope account reads.

## Intended future flow (not implemented)

1. An authenticated user submits one PDF or workbook to an institution-approved service.
2. The service verifies the caller and centre authorization itself, validates file type/size, and processes data locally using approved tools.
3. Extracted values are shown for manual verification; validation rules are supplied and approved by the institution.
4. After explicit confirmation, the service writes only to the authorized centre destination using approved Drive permissions.
5. A privacy-reviewed audit event records necessary workflow metadata without copying health values into logs.
6. Temporary files are removed according to the approved retention policy; failures do not report a successful write.

This is a requirements outline only. No real-data step above exists in the current application. The account-audit table is read-scoped but does not yet receive write events because account changes and data operations are disabled.
