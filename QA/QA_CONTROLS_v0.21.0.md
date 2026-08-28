# Controls redesign v0.21.0

Controls are recurring operational obligations, not audits/checklists.

Implemented:
- Central control definitions and department assignments.
- Department-scoped visibility through role UX policy.
- Central Infection Control-created controls may target multiple departments.
- Daily schedules support 1, 2, 3+ executions and explicit times.
- Monthly and multi-month frequency model; extensible to weekly/yearly/custom.
- Registry filters: search, department, status, frequency.
- Registry columns: control, departments, frequency, last execution, next execution, status.
- KPI summary for active, due soon, overdue, today's executions.
- Full control record with programme and execution history tabs.
- Separate 'Καταχώρηση ελέγχου' from 'Επεξεργασία προγράμματος'.
- Programme editing is management-only; assigned users can execute.
- Each execution is a separate history record.

Next:
- New/Edit Control form with department multi-select and schedule builder.
- Robust next-due calculation after execution for all recurrence types.
- Notifications/reminders.
- Supabase persistence/RLS at final backend phase.
