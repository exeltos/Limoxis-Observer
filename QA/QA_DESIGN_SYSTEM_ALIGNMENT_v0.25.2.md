# v0.25.2 — Design-system alignment

## Tabs
Surveillance and Quality canonical category tabs now use the exact Prevention/base tab geometry:
- 10px/12px strip padding
- 9px/11px tab padding
- 12px label size
- 8px active radius
- flat strip with bottom divider
No separate floating rounded container.

## Committees
Removed the custom one-off toolbar visual language:
- shared RecordActions for Create / Print / Export
- shared FilterBar + FilterSelect
- shared action-button treatment inside committee detail actions
- registry remains a standard surface + scroll-table
The committee domain behavior is unchanged.
