# v0.26.80 — Governed lifecycle migration, batch 2 / Laboratory

## Laboratory migration
Laboratory finalized/reopen workflows now use the shared governed lifecycle primitives instead of independently reconstructing audit metadata.

Migrated:
- Standard laboratory record finalization
- Standard laboratory record correction/reopen
- Employee screening laboratory finalization
- Employee screening correction/reopen
- Environmental sample finalization
- Environmental plate finalization
- Environmental laboratory correction/reopen

## Preserved domain events
The common lifecycle event is retained together with the laboratory-specific timeline event (`laboratoryRecordFinalized`, `laboratoryRecordReopened`, `employeeScreeningFinalized`, environmental finalization events). This preserves current UI/history semantics while adding a platform-wide governance layer.

## Correction behavior
Reopening:
- requires the existing mandatory reason
- records correction actor name + stable actor ID
- records timestamp and updated metadata
- clears finalization lock fields
- returns the workflow to processing/editable state
- preserves prior history

## Regression coverage
The governed lifecycle checker now verifies actual adoption in Prevention, Quality and Laboratory, increasing from 7 to 13 assertions.

## Verification
- Governed lifecycle: 13/13
- Clinical i18n
- Laboratory i18n
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Observer UI patterns
- Product i18n
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
