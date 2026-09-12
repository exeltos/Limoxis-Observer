# Limoxis Observer v0.42.0 — Surveillance Center Live

- Fixed live Supabase clinical surveillance hydration (removed invalid AST `tested_at` query).
- Aligned AST and critical communication field mappings with current Supabase schema.
- Added lifecycle surveillance event types in Supabase constraint.
- Added Platform Owner RLS access to employee surveillance records/batches.
- Fixed surveillance case close status (`closed`, not invalid `completed`).
- Added `therapy_plan_id` when creating antimicrobial therapy.
- Patient registry rows now open the surveillance clinical record instead of a fabricated laboratory route.
- Environmental surveillance now exposes compact All / Surfaces / Water sub-tabs.
- Reduced oversized empty workspace and KPI/table spacing for a denser clinical layout.
