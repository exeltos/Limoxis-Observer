# v0.26.67 — EL/EN UI audit batch 6

## Documents
- Documents registry is bilingual: page copy, KPIs, filters, table headers, type/status labels, export feedback and empty state.
- New Document dialog is bilingual while preserving stable stored enum values.
- Document Record is bilingual for tabs, metadata, publish/archive confirmations, files/attachments and edit dialog.
- Document History is bilingual and uses the active locale for date/time display.

## Audit
- The full English-risk scanner was rerun before this batch: 45 interactive files / 666 Greek-containing source lines.
- This scanner is intentionally conservative and also counts bilingual literals, demo/domain data and historical audit strings.
- Next recommended batches: LIRA, Controls deep modals, then remaining Prevention/Management surfaces.
