# Training cards & actions v0.26.9

Second Training normalization pass.

## People fields
- Programme owner and trainer now behave as hybrid staff/text fields.
- The user can select an active employee from suggestions OR type an external/free-text person.
- When the typed value exactly matches staff, employeeId is retained; otherwise it remains a valid free-text value.
- Same behavior is available on create and edit.

## Card / action audit
- Programme Summary: Edit/Delete moved to the shared compact record-inline icon pattern.
- Participants: Add remains the primary section action; attendance correction is a compact row icon.
- QR: no longer a standalone card/tab. QR buttons are secondary utilities in Participants; preview/print/regenerate opens in the shared ObserverDialog.
- Materials: Add is primary; Edit/Delete use compact row icons.
- Assessment: New question is primary; Edit/Delete use compact row icons.
- Results: standard table + summary strip; no special action card.
- Certificates/Evidence: replaced card gallery with the same scroll-table/data-table pattern used by registries.
- Removed the unused legacy QR record-subcard implementation.
- Create: Save/Cancel remain in the standard fixed footer.

No new visual language or module-specific button system was introduced.
