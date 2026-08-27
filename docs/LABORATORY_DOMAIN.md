# Laboratory & Microbiology domain — v0.6.0

The laboratory is the source of truth for specimen lifecycle, microbiology results and AST. Surveillance consumes these records by reference; it does not duplicate them.

## Model
Request/collection → receipt/acceptance → processing → preliminary/final result → validation/amendment. These are lifecycle states, not a clinical surveillance wizard.

AST is structured per antimicrobial and retains method, MIC/zone when available, S/I/R, breakpoint standard and version. With current EUCAST terminology, S and I are susceptible categories and R is resistant; I must not be silently grouped with R.

MDR/XDR/PDR is not a specimen workflow step. Classification is stored separately with definition source/version, calculation evidence and review status so future definition changes do not rewrite historical interpretation.

Critical-result communication is modeled as a separate append-only record because a result may require more than one communication/escalation. It retains who communicated, when, recipient, role and method.

## EL/EN
All visible Laboratory UI strings use the common language layer. Clinical organism and antimicrobial names remain canonical data rather than translated free text.
