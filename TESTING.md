# Testing

## Automated checks

Run:

```sh
bun run test
bun run lint
```

The route/schema test checks route matching, common parameter order and uniqueness, the 72-name list, 16 centres, and separation of the two centre extensions. These checks do not establish production security or data-processing correctness.

## Manual workspace checklist

- Visit `/`, `/upload`, `/import`, `/activity`, and `/admin`.
- Switch the dashboard centre and confirm the displayed centre updates.
- Confirm dashboard record and submission counts are zero and completeness is unavailable.
- Confirm PDF fields, workbook columns/rows, and activity history contain no fabricated values.
- Search parameters and centres, and use the centre filter in activity.
- In Admin overview, confirm the configured centre list remains available and record counts are zero.
- Confirm data-dependent actions remain unavailable while Drive is disconnected.

The sign-in, password-reset, protected-route redirect, and account settings screens were checked in the local preview. Email delivery and reset completion require approved test accounts and have not been end-to-end verified.

No real report, participant record, Drive account, or workbook should be used for testing this application.
