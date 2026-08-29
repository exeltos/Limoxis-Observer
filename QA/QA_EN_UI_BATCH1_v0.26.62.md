# v0.26.62 — EL/EN + UI consistency batch 1

## Modules reviewed
1. Surveillance
2. Laboratory
3. Controls — registry, record and cancellation flow

## Fixes
- Environmental Surveillance remove/confirm/feedback now follows EL/EN.
- Laboratory access-denied, correction action and workflow navigator now follow EL/EN.
- Controls registry labels, filters, KPI labels, table headings, statuses, tooltips and feedback now follow EL/EN.
- Control record core labels, statuses, governance messages, history table and actions now follow EL/EN.
- Control cancellation/void dialog now follows EL/EN.
- Existing shared registry patterns were preserved: FilterBar, sticky table, record shell, shared actions and fixed content structure.

## Deliberately not mass-rewritten
Control Editor/Execution and Prevention contain larger workflow-specific text sets. They remain the next controlled translation batch to avoid changing clinical/operational behavior with a bulk replacement.
