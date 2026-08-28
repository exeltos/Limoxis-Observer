# v0.26.22 — LIRA two-entry model

Final product direction:
1. **Ρώτησε τη LIRA** — primary/default entry. Questions are answered from Limoxis data, with links back to primary workflows.
2. **LIRA Briefing** — proactive, prioritized synthesis: what needs attention, what changed, and suggested checks.

Removed the separate Overview and Risk Signals navigation tabs. Risk signals remain an internal analytical primitive feeding both Ask LIRA and Briefing.

Governance:
- LIRA may never broaden a user's access.
- Final Supabase adapter must apply tenant, role and department scope/RLS before data reaches LIRA.
- Answers must remain traceable to primary records.
- LIRA does not diagnose, prescribe, or mutate clinical records autonomously.
