# v0.26.83 — Training & Committee evidence governance

## Training
Training evidence now carries stable audit metadata across the important evidence-producing actions.

### Programs
- New programs initialize created/updated actor metadata.
- Program updates persist `updatedAt`, `updatedBy`, `updatedById`.
- Updates are added to the training audit history.

### Assignments & attendance
- New participant assignments persist creator/update actor metadata.
- Attendance response changes persist update actor metadata and a history event.
- Participant removal history now uses the real audit actor and stable actor ID instead of a hard-coded role label.

### Completion & certificates
- Completion records `completionConfirmedAt`, `completedBy`, `completedById`.
- Assignment update metadata is persisted.
- Competency evidence certificates persist `issuedAt`, `issuedBy`, `issuedById`.
- Completed competent assignments are now explicitly linked to the generated certificate via `certificateId`.
- Completion creates a training audit-history event.

## Committees
- New meetings initialize standard created/updated actor metadata.
- Decisions generated from finalized minutes initialize actor metadata.
- Manually created decisions initialize actor metadata.
- Existing meeting finalization continues to persist `finalizedById`.

## Governance principle
Training and committee workflows keep their own domain-specific lifecycle. The work strengthens evidence traceability without imposing the generic record reopen/void model on workflows where it does not fit.

## Verification
- Evidence governance: 7/7
- Document revision lifecycle: 8/8
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Clinical/Lab/Product i18n
- Observer UI
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
