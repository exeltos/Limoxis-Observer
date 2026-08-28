# Controls execution/audit — v0.21.5
- Quick execution opens a full execution card with control, department, scheduled time, authenticated user, result/notes and explicit confirmation.
- Actor identity is taken automatically from the authenticated profile/session.
- Platform Owner has full control access: create, edit, delete and execute across departments.
- Normal department execution remains date/time gated.
- Definition create/update/delete and execution complete/cancel write actor-aware audit events.
- Wrong executions can be cancelled/reversed with mandatory reason; original history stays visible as cancelled.
- Cancelling the latest execution restores the prior last/next schedule state.
