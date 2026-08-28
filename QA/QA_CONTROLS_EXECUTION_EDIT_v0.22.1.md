# Controls execution edit — v0.22.1

- Added edit icon to completed control executions.
- Edit reopens the same execution form with existing values/list rows.
- Saving an edit updates the existing execution rather than creating a new execution.
- Audit trail preserves before/after values, editor identity, edited timestamp and revision count.
- Existing cancellation/reversal remains separate.
- Structured-list fields are optional. An empty list means no findings and does not block completing the control.
- Empty structured rows are discarded on final save.
