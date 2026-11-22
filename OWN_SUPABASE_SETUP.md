# Move TERIIP to your own Supabase project

The app uses Supabase Auth for sign-in and email, Postgres for account profiles,
roles and the account audit log, and Row Level Security (RLS) to keep centre
accounts within their assigned centre. Participant reports and values are not
stored in these database tables.

## What moves

The new project needs the TERIIP database objects and Auth configuration; they
are not copied automatically from Lovable Cloud. Run
[`supabase/OWN_SUPABASE_SETUP.sql`](./supabase/OWN_SUPABASE_SETUP.sql) once in
the new project's SQL Editor. It creates the profile, role and account-audit
tables; centre role enum; role-check functions; signup/email-change triggers;
and RLS policies.

Auth users and passwords do not automatically move between Supabase projects.
The provisioning script creates/invites accounts in the new project. Your old
Super Admin email can be invited again, but its old password does not transfer.
The Google Drive Sheets and Python extraction service are separate systems and
are not migrated by this SQL setup.

## Local environment

Fill these placeholders in the root `.env.local` file. Do not put secret keys
in `VITE_*` variables, source files, or Git:

| Variable                             | Value                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                  | New project's Project URL                                                                                                 |
| `SUPABASE_URL`                       | Same Project URL                                                                                                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY`      | New project's publishable key                                                                                             |
| `SUPABASE_PUBLISHABLE_KEY`           | Same publishable key; server-side Auth verification uses it                                                               |
| `SUPABASE_SERVICE_ROLE_KEY`          | New project's server-only `service_role` or secret key; used only by trusted server functions and the provisioning script |
| `TERIIP_SUPER_ADMIN_EMAIL`           | Your Super Admin email (`chirag.icmr@gmail.com`)                                                                          |
| `TERIIP_APP_URL`                     | `http://localhost:8080` for local account invitations                                                                     |
| `TERIIP_AUTH_REDIRECT_ORIGINS`       | `http://localhost:8080` locally; add the exact production site origin when deployed                                       |
| `VITE_TERIIP_EXTRACTION_SERVICE_URL` | Local extraction URL during development; the HTTPS Cloudflare tunnel URL in Netlify                                       |
| `TERIIP_EXTRACTION_TOKEN_SECRET`     | Random 32-byte-or-longer secret shared by the Netlify server and local extraction service; never use a `VITE_` prefix     |

Use the Project URL and publishable key from the new project's **Project
Settings → API** (or **API Keys**) page. The service-role/secret key is shown in
that same area. It bypasses database policies, so keep it only in `.env.local`
and Netlify's server environment settings; never share it in chat or commit it.

## Netlify environment variables

Set these in the Netlify site environment-variable UI, not in `netlify.toml`:

- Public/build-time: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_TERIIP_EXTRACTION_SERVICE_URL`.
- Server/function-only: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `TERIIP_APP_URL`,
  `TERIIP_AUTH_REDIRECT_ORIGINS`, `TERIIP_DRIVE_READS_ENABLED`,
  `TERIIP_GOOGLE_SERVICE_ACCOUNT_EMAIL`,
  `TERIIP_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
  `TERIIP_PARTICIPANT_WORKFLOW_APPROVED`, `TERIIP_EXTRACTION_TOKEN_SECRET`,
  `MASTER_TRACKER_SHEET_ID`, and `MASTER_TRACKER_TAB`.

`TERIIP_SUPER_ADMIN_EMAIL` is only needed when running the local account
provisioning script. `TERIIP_EXTRACTION_ALLOWED_ORIGINS` is only read by the
laptop extraction service.

For production, set both `TERIIP_APP_URL` and
`TERIIP_AUTH_REDIRECT_ORIGINS` to the exact HTTPS Netlify site origin (for
example, `https://your-site.netlify.app`, without a trailing slash). Update
Supabase Auth's Site URL and Redirect URLs to match. `TERIIP_EXTRACTION_ALLOWED_ORIGINS`
is read by the laptop service, so put `http://localhost:8080` and the exact
Netlify origin in the service's `.env.local`, not in the Netlify app.

Store `TERIIP_EXTRACTION_TOKEN_SECRET` only in Netlify's function environment
and the local service's `.env.local`; use the same randomly generated value in
both. Set `VITE_TERIIP_EXTRACTION_SERVICE_URL` to the public HTTPS Cloudflare
Tunnel base URL (without `/extract`). Rebuild after changing any `VITE_` value.

For the Google service account, paste the complete `private_key` value from
the downloaded JSON key into the single
`TERIIP_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` Netlify variable. A PEM value with
literal `\n` line breaks is accepted by the app. Do not upload the JSON file or
put the key in `netlify.toml`, source code, or a `VITE_` variable. Netlify
documents a 5,000-character value limit; its function runtime also inherits
AWS's 4 KB aggregate environment-variable limit, so keep function-scoped values
small. Netlify's environment-variable documentation:
https://docs.netlify.com/build/environment-variables/overview/

The existing Google variables in `.env.local` remain separate:
`TERIIP_DRIVE_READS_ENABLED`, the service-account email/private key,
`MASTER_TRACKER_SHEET_ID`, `MASTER_TRACKER_TAB`,
and `TERIIP_PARTICIPANT_WORKFLOW_APPROVED`. The local extraction service also
uses `TERIIP_EXTRACTION_ALLOWED_ORIGINS`, a comma-separated list containing
`http://localhost:8080` and the exact Netlify site origin.

## Supabase Auth dashboard settings

In the new project's **Authentication → URL Configuration**:

1. Set **Site URL** to `http://localhost:8080` during local testing.
2. Add `http://localhost:8080/**` to **Redirect URLs**.
3. Before deployment, set the Site URL to `https://<your-site>.netlify.app`
   and add `https://<your-site>.netlify.app/**`. Add
   `https://<your-custom-domain>/**` too if you use one.
4. Set `TERIIP_APP_URL` and `TERIIP_AUTH_REDIRECT_ORIGINS` in the deployment
   environment to the production URL/origin. The latter is a comma-separated
   list of allowed origins.

In **Authentication → Sign In / Providers**:

- Enable Email; disable public sign-ups so only administrator-created accounts
  can enter.
- Require email confirmation. Turn **Secure email change off**: centre users
  begin with an intentionally undeliverable temporary login address, so Supabase
  cannot require confirmation at both the old and new addresses. The app uses
  Supabase's email-change confirmation link and keeps the new email out of the
  profile until that link is used. Set the minimum password length to 12
  characters; the app also checks a 12-character minimum.
- Configure and test the invitation, email-change confirmation and password
  reset email templates and sender.
- Keep Supabase's Auth rate limits enabled; optionally enable CAPTCHA for
  additional protection against repeated sign-in attempts.

## Create the initial accounts

After the SQL is applied and the URL/key values are filled in:

1. Run `npm run provision:accounts` from this folder.
2. The script invites `teriipicmr@gmail.com` and the email in
   `TERIIP_SUPER_ADMIN_EMAIL` as Super Admins. Each sets a password from the
   email link. The existing password from the old project is not copied.
3. It creates Centre Admin accounts using the fixed centre usernames and
   one-time random passwords. Those credentials are written to the ignored
   local file `temp-credentials.csv`. Give each centre its own row privately.
4. Keep that CSV off shared drives and delete it securely after each centre has
   received its credentials. The app cannot recover those temporary passwords.

The provisioning script will not run until `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` have real values. Do not run it against the old
Lovable project by mistake.

## Hosting limitation to plan for

The dashboard's Google reads and Sheets writes run in the app server and need
the corresponding server-only variables in Netlify. The PDF/CSV extractor stays
on your laptop at `127.0.0.1:8765`; a Cloudflare Tunnel exposes it over HTTPS
so the browser can upload directly. The browser's Netlify origin must be listed
in the service's `TERIIP_EXTRACTION_ALLOWED_ORIGINS`. The app server signs a
five-minute token containing the authorized centre key and user ID; the service
uses the token's centre key, not a centre supplied with the file.
