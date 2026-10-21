<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture

- The current TERIIP workspace is a synthetic-only, in-memory TanStack Start demonstration with mock Drive status; this keeps the preview from processing real participant data or pretending that external writes succeeded.
- Share temporary centre selection and optional-field configuration through a React context provider so the demo screens remain consistent without persisting participant-related data.
- The requested target has changed to Lovable Cloud for managed authentication and backend data; keep private records and role/centre authorization server-enforced, and do not enable real-data workflows until Drive configuration and institutional privacy/security approvals are verified.
- Use Lovable Cloud Auth for account identity and keep display/profile attributes separate from role grants; authorize account administration and centre access through server-checked roles plus database RLS so browser-controlled state cannot grant privileges.
- Accounts without a real email sign in with a temporary username mapped to the reserved undeliverable domain in `src/lib/teriip-access.ts`; first-login steps live in server-only `app_metadata.teriip_onboarding` and database role checks refuse access until it is cleared, so a temporary login can never reach centre data.
- Workspace pages live under the `_authenticated` layout; `/` stays public but renders only a sign-in prompt until a fully set-up account is present.
