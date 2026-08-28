# Controls structured forms — v0.21.7

- Every control definition can specify its response type: text, numeric with unit/ranges, choice, or structured list.
- Numeric out-of-range values are identified as findings.
- Choice controls can flag non-conforming values.
- Structured list templates include medication/material expiry and a generic findings list.
- Medication/material form captures item, LOT, expiry, quantity, finding and action across multiple rows.
- Execution card supports save draft, print form and create related Quality incident/report.
- Related report is prefilled with control ID/title, department, result, notes and structured findings.
- Completed structured executions are stored with the execution, summarized in history and can be printed again.
- User identity remains automatic from login/audit metadata.
