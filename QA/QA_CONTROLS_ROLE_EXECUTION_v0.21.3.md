# Controls role/execution rules — v0.21.3

- Infection Control Lead can create central controls and assign them to multiple departments.
- Central Infection Control definitions are read-only after assignment from department screens.
- Department Manager can create controls only for their own department.
- A department-created definition can be edited only by the manager of that same department.
- Department User cannot create new control definitions.
- Department Manager/User may execute an assigned control only when its next scheduled date/time has arrived (or is overdue).
- Each list row exposes a compact quick-execution icon; it remains disabled before due time.
- Clicking a row opens locked control details plus the execution history.
- Multi-department central controls maintain separate last/next/history state for each department assignment.
