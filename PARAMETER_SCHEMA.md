# Parameter schema

The UI schema is defined in `src/lib/teriip-schema.ts`. It groups canonical parameter names for display and includes a limited set of source aliases. It does not encode clinical reference ranges or perform medical interpretation.

## Count discrepancy

The brief says “66–67 common parameters,” while its explicit ordered standard-column list contains **72 unique names**. The demo preserves all names in that explicit list, rather than dropping six fields. This discrepancy should be confirmed by the project data owner before production schema migration or import validation.

## Centre-specific fields

`MRD No` and `ABO & Rh Blood grouping` are kept out of the common list. The demo allows an administrator-preview user to explicitly enable both fields for a selected centre; it does not assume which centre uses them. This setting is in-memory and resets on refresh.

## Validation

The schema contains labels, display categories, units where specified, and some aliases. No clinical thresholds, allowed-value catalogs, mandatory-field policy, or out-of-range behavior is invented here. Those must be provided by the institution and validated server-side in the production service.