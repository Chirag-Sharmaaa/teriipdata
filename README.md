# TERIIP Research Workspace

This TanStack Start application uses an independently configured Supabase project for sign-in and server-enforced centre roles. Its Google Drive reader accesses the 16 mapped centre workbooks and configured master tracker with a server-only service account. Participant data is not stored in the app database. PDF/CSV files are sent directly from the browser to the separate extraction service through its HTTPS tunnel; the app server only issues five-minute, centre-scoped extraction tokens. Reviewed records are written to Google Sheets.

## Local setup

1. Fill in the Supabase placeholders in `.env.local` using [OWN_SUPABASE_SETUP.md](./OWN_SUPABASE_SETUP.md). `.env.local` is ignored by Git.
2. In Google Cloud Console, select/create a project and enable the **Google Drive API**. Create a service account under **IAM & Admin → Service Accounts**, then create a JSON key. From that JSON, copy `client_email` and `private_key` into `TERIIP_GOOGLE_SERVICE_ACCOUNT_EMAIL` and `TERIIP_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` in `.env.local`. Keep the private key server-side; never add a `VITE_` prefix, commit it, or send it in chat.
3. Set `MASTER_TRACKER_SHEET_ID` to the ID from the master spreadsheet URL and `MASTER_TRACKER_TAB` to its exact tab name.
4. Share only the 16 destination spreadsheets listed in `src/lib/drive-datasets.ts` and the master tracker with the service-account email as a Viewer. Do not share the parent reports folder, which also contains participant PDFs.
5. After institutional privacy/security approval, set `TERIIP_DRIVE_READS_ENABLED=true`. Restart the dev server after changing `.env.local`.

The server loads private environment variables for server functions. The browser receives neither the service-account key nor the Supabase service-role key. This reader calls Google Drive API directly and does not use a hosted Drive connector or gateway.

```sh
npm install
npm run dev
npm test
```

The dashboard fetches Drive data only when **Refresh dashboard** is clicked. The query result remains in memory while the app stays open; it is not persisted in browser storage.

## Workspace screens

- `/` — centre dashboard and, for Super Admins, live counts for all configured centres.
- `/upload` — review an extracted PDF/CSV report and append the approved row to the selected centre sheet.
- `/activity` — empty workflow history until processing is implemented.
- `/admin` — centre selection, status metrics, Drive setup and account management.
- `/auth`, `/reset-password`, `/settings`, `/manage-users` — protected authentication and account screens.

The current completeness percentage is the share of populated cells in a centre dataset, not achievement against an annual target. The target-summary sheet is not yet mapped.

## Read next

- [Architecture](ARCHITECTURE.md)
- [Security and privacy boundary](SECURITY.md)
- [Data flow](DATA_FLOW.md)
- [Parameter schema](PARAMETER_SCHEMA.md)
- [Deployment status](DEPLOYMENT.md)
- [Testing](TESTING.md)
- [Current scope and limitations](DEMO_SCOPE.md)
- [Own Supabase setup](OWN_SUPABASE_SETUP.md)
