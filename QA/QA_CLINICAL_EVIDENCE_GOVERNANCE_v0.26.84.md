# v0.26.84 — Clinical surveillance evidence governance

## Scope
Strengthens the surveillance episode lifecycle without applying one generic lifecycle to every clinical sub-state.

## Surveillance creation
New surveillance episodes now initialize:
- lifecycle status
- created/updated timestamps
- actor display name
- stable actor ID
- timeline actor ID

## Erroneous active episode / void
The existing restricted delete action remains a non-destructive void:
- only active episodes can be voided
- reason remains mandatory
- audit snapshot remains preserved
- void actor ID and update metadata are now stored
- timeline event includes actor ID

## Completed episode reopen
Reopening a completed surveillance episode remains permission-controlled and reason-required.
It now records:
- `correctionOpenedAt`
- `correctionOpenedBy`
- `correctionOpenedById`
- updated actor metadata
- timeline actor ID

The prior outcome is copied to `previousOutcome` before the active outcome is cleared. This avoids silently losing the clinical closure evidence when an episode is reopened for correction.

## Deliberate non-changes
Therapy, isolation, reassessment, HAI classification and outcome remain separate clinical state machines. This batch does not lock routine active-surveillance editing or force generic governed dialogs into each clinical action.

## Verification
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
