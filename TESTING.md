# Testing

## Automated checks

Run:

```sh
npm test
npm run lint
```

The tests cover route matching, role boundaries, the dataset summary calculation, and mocked Google service-account token exchange. They do not establish production security or data-processing correctness.

## Manual workspace checklist

- Visit `/`, `/upload`, `/activity`, and `/admin`.
- Switch the dashboard centre and confirm the displayed centre updates.
- Confirm Drive is not queried on page load and a manual dashboard refresh performs the query.
- With Drive reads disabled or server credentials missing, confirm the dashboard reports the configuration state without returning data.
- Confirm PDF fields, workbook columns/rows, and activity history contain no fabricated values.
- Search parameters and centres, and use the centre filter in activity.
- In Admin overview, confirm the configured centre list remains available and record counts are zero.
- Confirm Google credentials and access tokens never appear in browser bundles, responses, or logs.

The sign-in, password-reset, protected-route redirect, and account settings screens were checked in the local preview. Email delivery and reset completion require approved test accounts and have not been end-to-end verified.

Automated tests must use generated keys and mocked Google responses only. Do not use real participant records, reports, or workbooks in tests.
