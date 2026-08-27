# Prevention domain — v0.8.0

Prevention is a shared operational domain, not a single generic form. The first clean-core release contains four governed streams:

- WHO hand-hygiene observation sessions.
- Healthcare-waste measurements using the shared waste-category library.
- Antiseptic-consumption periods using the shared antiseptic library.
- Prevention bundle assessments (CLABSI / CAUTI / VAP foundation).

## Locked product rules

- The screen shell and tab bar remain fixed; lists and tables own the scroll.
- Every registry uses the common filter system: frequent filters remain visible and advanced filters open through one filter control.
- Department and master-data values come from governed libraries.
- Indicators consume source records directly; users do not re-enter numerator data in the Indicators Center.
- Create/edit/delete/export/attachments remain permission-aware and auditable.
- EL/EN labels are resolved through the shared i18n layer.
- Help/Info grows with the module and is finalized with a cross-role completeness audit before 1.0.
