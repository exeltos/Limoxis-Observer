# v0.26.77 — Audit metadata normalization, batch 4 / lifecycle actors

## Scope
Final metadata-focused pass before broader finalized/correction/reopen lifecycle work.

## Changes
- Laboratory result validation now persists `validatedById` and standard updated metadata.
- Laboratory finalization paths now persist `finalizedById`.
- Laboratory finalized/reopened timeline events now include stable `actorId`.
- Reopening a laboratory record clears both `finalizedBy` and `finalizedById` while recording the correcting actor in updated metadata and timeline.
- Employee-screening laboratory finalization carries actor ID.
- Environmental laboratory sample/plate finalization carries actor ID.
- Committee meeting finalization carries `finalizedById` and standard updated metadata.

## Governance
Human-readable names remain available for UI/history, while stable actor IDs are persisted for future Supabase UUID/RLS mapping.
No historical seed evidence is rewritten.

## Verification
Passed:
- Clinical i18n
- Laboratory i18n
- Product permissions: 22
- Navigation: 18/18
- React hooks: 136
- Observer UI patterns
- Product i18n
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
