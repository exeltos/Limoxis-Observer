# v0.26.63 — EL/EN + workflow UI batch 2

## Controls
- Control Editor now follows EL/EN across sections, scheduling, response type, instructions and actions.
- Added a visible English control-name field (`titleEn`) so custom hospital controls can display a proper English name instead of falling back to Greek.
- Control Execution now follows EL/EN for confirmations, findings, ranges, notes, draft saving, incident reporting and structured lists.
- Date/time formatting now follows the active locale.

## Prevention
- WHO Hand Hygiene session editor now has bilingual WHO 5 Moments labels, professions, actions, summary and confirmation/removal messages.
- Waste measurement editor now follows EL/EN, including indicator and patient-day provenance.
- Antiseptic consumption editor now follows EL/EN, including ABHR eligibility, denominator provenance and method labels.
- Bundle execution now follows EL/EN for context, shifts, answers, findings and completion.
- Generic Prevention entry dialog now follows EL/EN.

## Design / workflow
Existing Observer dialog/card structure, shared date/time fields, fixed content areas and governed confirmation patterns were preserved.
