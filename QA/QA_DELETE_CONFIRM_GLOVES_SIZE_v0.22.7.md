# Delete confirmation + WHO gloves sizing — v0.22.7

- WHO `Χρήση γαντιών / Gloves` card is one grid column wide and 54px high, matching each HR/HW/Missed action card.
- The WHO action selector spans the full 3-column row so all four cards share the same column width.
- Shared `RecordActions` now confirms DELETE centrally before dispatching the action.
- Direct delete/removal buttons were audited across the platform.
- Attachments, laboratory AST rows, organism rows, WHO observations and structured control rows now confirm before removal.
- Existing record deletes in Management, Quality, Prevention, Controls, Surveillance and Employees already use confirmation.
- Confirmed direct removals now also emit success feedback where it was missing.
