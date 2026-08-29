# v0.26.66 — EL/EN UI audit batch 5

## Training
- Deep registry tables, filters, result views, certificates and evidence labels now follow EL/EN.
- Participant/result status wording now follows EL/EN.
- Fixed status badge rendering so bilingual status arrays are resolved to the active language rather than rendered as raw array content.
- Employee/free-text helper field now has bilingual guidance.
- Public QR flow improvements from v0.26.65 retained.

## Committees
- Deep committee dialogs now follow EL/EN for member creation, meeting creation, meeting/minutes workspace, attendance/quorum, topics, decisions/actions and annual-plan objectives.
- Governed removal confirmation for meeting topics is bilingual.
- Stored historical/domain values remain stable where changing persistence values could affect audit/history matching.

## QA
Static product audits are executed before packaging. A full npm dependency install was attempted in the execution environment but did not complete within the available tool execution window, so this release does not claim a completed local lint/test/Vite build.
