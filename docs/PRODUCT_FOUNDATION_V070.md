# ADR — v0.7.0 Product Foundation

## Decision
All modules in Limoxis Observer use common engines/components for authorization-aware actions, attachments, feedback, Help/Info, indicators and governed reference data.

## Rationale
The previous Healthcare Suite and Limoxis Observer material already contained useful patterns for contextual help, attachments, indicators, patient-days and role-driven workspaces. The clean rebuild keeps those product requirements while removing page-specific implementations and duplicated permission logic.

## Action contract
Every record can declare supported actions (`create`, `edit`, `delete`, `complete`, `approve`, `attach`, `print`, `export`, `assign`, `manage`). The action is rendered only when the generic action capability and any resource-specific capability are both satisfied. The server/RLS must independently enforce the same rule.

## Denominators
`calculated_patient_days` derives patient-days from admissions. `patient_days` stores controlled manual/import overrides. `effective_patient_days` resolves the effective denominator while preserving provenance. Device-days will follow the same pattern when device exposure is fully modelled.

## External references
Official sources are versioned records. Update detection and source retrieval are separate from activation. Clinical definitions, notifiable-disease rules, antibiotic lists/breakpoints and indicator formulas can only switch version after an authorized review/approval step.

## v0.7.1 clarification
- Libraries are a governed master-data center, not scattered dropdown constants.
- Patient-days are manual/imported period denominators, by department or whole hospital. They are not inferred from surveillance patients.
- Contextual Info/Help is implemented as shared infrastructure and is completed incrementally per module, followed by a final completeness audit.
- Analysis is intentionally a later cross-domain workspace that will combine indicators, trends, drill-downs, reports and LIRA-assisted interpretation after source domains are mature.
