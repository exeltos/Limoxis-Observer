# v0.26.85 — Clinical event audit normalization

## Purpose
Normalize actor/timestamp evidence for meaningful clinical events while preserving simple editing during an active surveillance episode.

## Therapy
- Therapy rows retain creator metadata.
- Row edits persist updater actor name/ID/time.
- Saving therapy updates the surveillance record metadata.
- `therapyUpdated` timeline events now include actor ID.

## Reassessment
- Each reassessment is treated as a new clinical event rather than an overwrite.
- Stores `by` + `byId` and creation actor metadata.
- Surveillance update metadata is refreshed.
- Timeline includes actor ID.

## Outcome / episode closure
Outcome now acts as the clinical closure evidence:
- `recordedAt`, `recordedBy`, `recordedById`
- episode `lifecycleStatus='finalized'`
- `finalizedAt`, `finalizedBy`, `finalizedById`
- standard updated metadata
- timeline actor ID

The governed reopen work from v0.26.84 preserves the prior outcome before reopening.

## Isolation
Isolation decisions now retain `byId`.
Isolation records retain creator/updater actor metadata.
Timeline events include actor ID.

## Assessment / HAI classification / surveillance start
Meaningful updates now refresh record update metadata and timeline actor IDs.
Clinical assessment retains stable assessor ID.

## Verification
- Clinical event audit: 12/12
- Clinical evidence governance: 7/7
- Evidence governance: 7/7
- Document revisions: 8/8
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Clinical/Lab/Product i18n
- Observer UI
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
