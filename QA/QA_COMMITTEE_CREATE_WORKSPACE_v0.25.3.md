# v0.25.3 — New Committee workspace

Replaced the basic modal with a full record-style creation workspace.

Key rules:
- Uses the same EntityRecordShell / entry-grid / Button / ManualDateField patterns as other mature modules.
- Chair and secretary are selected from active hospital employees, not free text.
- Captures committee identity, type, constituting decision, legal basis, mandate, term, meeting frequency and quorum rule.
- Validates term dates.
- Stores authenticated createdBy/updatedBy metadata and history event.
- Members, meetings, minutes and decisions are managed after creation in the committee record.
- /committees/new requires MANAGE_COMMITTEES.
