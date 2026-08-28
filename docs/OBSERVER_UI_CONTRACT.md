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
- committee-specific legacy form shells are reintroduced.
