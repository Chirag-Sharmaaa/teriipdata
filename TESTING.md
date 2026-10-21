# Testing

## Automated checks

Run:

```sh
bun run test
bun run lint
```

The route/schema test checks route matching, common parameter order and uniqueness, the 72-name list, 16 centres, and separation of the two centre extensions. These checks do not establish production security or data-processing correctness.

## Manual preview checklist

- Visit `/`, `/upload`, `/import`, `/activity`, and `/admin`.
- Switch the dashboard centre and confirm the displayed centre updates.
- Search and edit the fabricated report fields; confirm only the demo confirmation appears.
- Change sample spreadsheet mappings and use the centre filter in activity.
- In Admin overview, confirm the synthetic centre list is available without optional-field controls.
- Confirm all banners indicate synthetic/demo data and no real file is requested.

The sign-in, password-reset, protected-route redirect, and account settings screens were checked in the local preview. Email delivery and reset completion require approved test accounts and have not been end-to-end verified.

No real report, participant record, Drive account, or workbook should be used for testing this preview.
