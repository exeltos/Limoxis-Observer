# Archived migrations

These 24 files were written into `supabase/migrations/` between 2026-09-01 and
2026-09-08 but were never applied to the live Supabase project
(`Limoxis-Observer`, `wnnssaicdsdgesysaamv`). Live production development
continued independently and directly against the database during the same
window (no CI/CD step in this repo has ever applied migrations to Supabase),
producing a parallel set of ~57 migrations covering the same problem areas
under different names — see `supabase/migrations/` for the accurate,
currently-live history, pulled directly from
`supabase_migrations.schema_migrations` on 2026-09-11.

Verified against the live database and the project's own Master Product
Blueprint before archiving:

- `indicator_role_scope_alignment.sql` references a `surveillance_cases.resistance_status`
  column that does not exist live, and duplicates a function
  (`private.indicator_metric_snapshot`) that already exists live, evolved through
  its own later live-only fixes.
- `workforce_role_scope_alignment.sql`, `laboratory_operational_scope_alignment.sql`,
  `antimicrobial_therapy_role_alignment.sql`, `clinical_write_capability_alignment.sql`
  all propose "for all" RLS policies where live already has more granular,
  independently-evolved per-operation (insert/read/update/delete) policies.
- `surveillance_role_scope_alignment.sql` and `hospital_admin_surveillance_read_alignment.sql`
  would restrict Doctor Reviewer to only case-assigned records. The project's own
  Master Product Blueprint states explicitly that "Infection Control Lead/Member
  and Doctor Reviewer have broader clinical visibility" — live's simpler,
  broader role-based model matches the documented product spec; this file does not.
- `patient_surveillance_lifecycle_alignment.sql` and
  `surveillance_lifecycle_transition_guard.sql` introduce a `close_surveillance_case`/
  `reopen_surveillance_case`/capability-RPC layer that doesn't exist live.
  The actual live-compatible void/reopen-with-reason fix, verified against the
  real schema, shipped instead as
  `supabase/migrations/20260911233434_surveillance_void_and_reopen_with_reason.sql`.
- `retire_legacy_training_rpcs_and_harden_internal_functions.sql` looks like a
  reasonable security hardening pass (revoking EXECUTE on internal trigger
  helpers), but as written it also revokes EXECUTE from `authenticated` on
  functions that live RLS policies call directly in their `USING`/`WITH CHECK`
  expressions (`current_user_has_org_role`, `is_org_admin`, `can_view_surveillance_record`,
  `current_user_has_capability`, `is_org_member`). Applying it as-is would have
  broken RLS authorization for every signed-in user across the app. Live's own
  history shows the same mistake was made and then reverted forward
  (`20260901231707_harden_internal_function_execute_and_search_path.sql` followed
  by `20260902203638/204254/204317_restore_*_rls_helper_execute_grants.sql`).
- The remaining files (committee governance, session/attachment/employee
  subrecord fixes, indicator RPC v1, a no-op release marker, an audit trigger
  fix, a bundle seed, quality FK fixes) all address problems live already
  solved under different migration names in the same window.

Kept for reference in case any of this design work (e.g. Doctor Reviewer
case-assignment scoping, if ever wanted as a deliberate product change) is
revisited later. None of these should be applied to the live database as-is.
