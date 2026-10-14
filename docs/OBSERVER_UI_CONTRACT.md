# Limoxis Observer — Canonical UI Contract

This document is the cross-application UI contract for the new Limoxis Observer. It is not a copy of the legacy Limoxis / Healthcare Suite.

## Utility actions
- Print and Export are compact icon-only actions everywhere.
- Print uses the Printer icon.
- Export uses the Download icon.
- Record headers use `PrintExportActions`.
- Registry/page toolbars use `RecordActions`; Print/Export are centrally forced to icon-only mode.
- Tooltips and aria-labels remain available even when visible text is removed.

## Forms and dialogs
- New dialogs use `ObserverDialog`.
- Existing feature dialogs inherit the same canonical border, radius, header/footer, focus, button and field styling through the global Observer form contract until their internal markup is migrated.
- Primary and secondary footer actions use the shared `Button` component/pattern.
- Long text uses the global textarea expander and remains vertically resizable.

## One way out of a window
- A dialog closes with its × alone: no «Ακύρωση» / «Κλείσιμο» / «Άκυρο» button beside it. Do not pass `showCancel` to `DialogActions`.
- A create or edit page inside `EntityRecordShell` returns with its back arrow (to the list when creating, to the record when editing): no separate Cancel at the foot.
- Editing in place inside a record card (no dialog, no back arrow of its own — e.g. Patient details, Employee details) keeps «Ακύρωση» beside «Αποθήκευση».

## Opening records
- A new main record (patient, employee) opens as its own page in `EntityRecordShell`, not as a dialog; saving opens the new record.
- Editing a record's core details happens in place in its details card, like the employee record.
- An action appears once: not both as a button and in a … menu, and not in two cards' menus. Card menus hold what concerns that card.

## Record tab content
- Inside `EntityRecordShell`, each tab's content sits in a white bordered card inset 13px from the record body on every side (the right side also keeps the body's scrollbar gutter), so the white body frames it. The patient record uses the same inset (`--pr-pad-x` / `--pr-pad-y`); a tab whose card fills the height (a list with its pager) keeps the inset at the bottom too.
- A card that must be wider than its content (lists) sets `width:calc(100% - 26px)` with the 13px margin — never `width:100%` plus margin, which pushes the right edge out.

## Empty lists
- An empty list says why, through `listEmptyCopy` / `ListEmptyState` (design-system/ListEmptyState.jsx): «Δεν βρέθηκαν εγγραφές με αυτή την αναζήτηση ή τα φίλτρα» when records exist but none match; otherwise «Δεν υπάρχουν …» with the «Πατήστε Δημιουργία…» hint only for those who can create.
- The message sits inside the table area (`inline-empty`, or `RegistryTable` `emptyTitle`/`emptyText`), not in a separate dashed box.
- `RegistryPagination` hides while the list is empty.

## Date and time
- Feature UIs must not render raw native date/time inputs.
- Dates use `ManualDateField` and display dd/mm/yyyy while preserving ISO values internally.
- Times use `TimeField`.

## Record pages
- `EntityRecordShell` is the canonical record shell.
- Record utility actions use `PrintExportActions`.
- Export must perform a real action; the generic fallback is a structured JSON record export.

## Guardrails
`npm run audit:observer-ui` fails if:
- visible Print/Export text actions are reintroduced,
- a feature renders a native date/time input,
- a record page bypasses `PrintExportActions`,
- a page has Print without Export in `RecordActions`,
- committee-specific legacy form shells are reintroduced,
- a feature dialog passes `showCancel` (files not yet reviewed are listed in the tool and leave the list as each module is aligned).
