# v0.26.31 — Protected professional libraries

- Enriched central libraries with a much broader baseline.
- Baseline rows include source/version metadata and are marked system/locked.
- Hospital users cannot edit or delete protected baseline rows.
- Hospital users can add local rows; local rows remain editable/deletable with confirmation.
- Added bilingual entry editing for local rows.
- Added source/reference column and visible governance status.
- Core reference enrichment includes WHO BPPL 2024, WHO AWaRe, EODY-oriented notifiable-disease references, CDC isolation categories, and healthcare/QMS core vocabularies.
- The data model remains backwards compatible: existing consumers still use row[0]/row[1]; metadata is stored in row[2].
