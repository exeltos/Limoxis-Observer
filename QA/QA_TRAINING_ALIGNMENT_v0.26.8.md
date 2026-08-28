# Training alignment v0.26.8
First normalization pass against established Limoxis patterns.

- New Training is a full record-style route `/training/new`, not a creation modal.
- Program detail uses `/training/:programId` and contextual navigation.
- Shared EntityRecordShell, RecordActions, FilterBar, Button and ManualDateField retained.
- Owner and trainer are selected from active employees rather than free text.
- Audience is controlled; department choices derive from active employee data.
- Primary detail navigation is reduced to: Σύνοψη, Συμμετέχοντες & παρουσία, Υλικό, Αξιολόγηση, Αποτελέσματα & τεκμήρια.
- QR is an attendance tool, not a primary tab.
- Training feedback is grouped with results.
- Existing QR/material/quiz/feedback/completion/certificate behavior is retained.

Next audit pass: authenticated employee mapping, department filters, governed correction of completed evidence, and unified Employee training history.
