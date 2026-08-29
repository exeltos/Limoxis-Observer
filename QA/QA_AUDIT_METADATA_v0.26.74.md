# v0.26.74 — Audit metadata normalization, batch 1

## Purpose
Begin the post-EL/EN governance pass by standardizing actor-aware audit metadata.

## Changes
- Added shared `creationMetadata(actor, at)` and `updateMetadata(actor, at)` helpers.
- Metadata now carries both human-readable actor name and stable `actorId`.
- Controls definition create/update now uses the common metadata helpers.
- Indicator hospital overrides now persist `updatedAt`, `updatedBy`, `updatedById`.
- New custom indicators persist created/updated timestamps plus actor name/ID.
- Existing custom indicators update `updatedAt`, `updatedBy`, `updatedById`.
- Hiding a built-in indicator records actor-aware local audit metadata while preserving the immutable source baseline.

## Governance
This is deliberately incremental. It does not rewrite historical seed/audit evidence and does not change stable IDs or existing persistence values. The same metadata contract can later map directly to Supabase `created_by` / `updated_by` UUID fields and RLS policies.

## Verification
Passed:
- Product permissions: 22 assertions
- Navigation smoke: 18/18
- React hooks smoke: 136 files
- Observer UI patterns
- Product i18n
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
