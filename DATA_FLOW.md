# Data flow

## Implemented preview flow

All current example values are static synthetic data imported by the browser application. A user may edit visible sample values, select mappings, filter a centre, and confirm an example. This changes React memory only; there is no file selection, network submission, persistent store, workbook, or Drive operation. Refreshing the preview clears those changes.

## Intended future flow (not implemented)

1. An authenticated user submits one PDF or workbook to an institution-approved service.
2. The service verifies the caller and centre authorization itself, validates file type/size, and processes data locally using approved tools.
3. Extracted values are shown for manual verification; validation rules are supplied and approved by the institution.
4. After explicit confirmation, the service writes only to the authorized centre destination using approved Drive permissions.
5. A privacy-reviewed audit event records necessary workflow metadata without copying health values into logs.
6. Temporary files are removed according to the approved retention policy; failures do not report a successful write.

This is a requirements outline only. No real-data step above exists in the current application.
