# v0.47.0 — Patient Surveillance Cleanup

Focused cleanup of the patient surveillance record after visual review.

- Removed the late duplicate patient-record geometry block from `core.css`.
- Removed patient-record-specific override fragments from the consolidated surveillance refinement block in `modules.css`.
- Added one authoritative patient-record layout file: `src/styles/patient-record.css`.
- Summary no longer repeats patient name/code/surveillance UUID already present in the record header.
- Surveillance tab now uses one unified episode table instead of separate Active/Completed cards.
- Technical surveillance UUID is kept for routing/data/export but hidden from primary clinical UI.
- Clinical Data is a single sequential workspace instead of a two-column nested-card mosaic.
- Documents and History use compact surfaces.
- Timeline strips raw UUID residue from visible event detail.
- Patient dates use fixed `dd/mm/yyyy` formatting.
- No Supabase schema/policy changes in this release.
