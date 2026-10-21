# Locked modules in aggregated reads

`20261201200000_module_enforcement_db.sql` closes the module tables for direct reads with
restrictive `<table>_module_gate` policies. This note audits the **aggregated** reads (RPCs the
front end calls with `supabase.rpc(`) and records how each decides about a locked module.
Migration: `20261207200000_module_gate_aggregates.sql`.

## Rule

* `private.org_modules_locked(org, modules[])` is true when the caller is not the Platform Owner
  and every module of the group is in `private.org_disabled_modules(org)` — exactly the gate
  policies' rule (a table serving several modules closes only when all of them are locked).
* A locked part returns zero / empty (never an error). The Analysis and Executive pages already
  hide locked sections through `moduleEnabled`, so no front-end change was needed.
* INVOKER functions run with the caller's rights, so RLS and the gates already apply: nothing to fix.

## Findings

| RPC | Kind | Module tables touched | Before | After |
|---|---|---|---|---|
| `dashboard_metrics` (incl. admin-home version) | INVOKER | many | covered by RLS gates | unchanged |
| `committee_overview_counts`, `control_*` (5), `kitchen_batch_balances`, `quality_survey_response_counts`, `surveillance_case_summaries`, `laboratory_sample_list`, `patient_infection_flags`, `get_organism_clusters`, `get_indicator_metric_snapshot` | INVOKER | their module tables | covered by RLS gates | unchanged |
| `analysis_domain_metrics` | DEFINER | surveillance, prevention, controls, quality, pharmacy | leaked | fixed |
| `analysis_crosstab_metrics` | DEFINER | surveillance, laboratory, pharmacy, controls, quality | leaked | fixed |
| `analysis_people_metrics` | DEFINER | governance (documents, committees); occupational health already via `current_user_has_capability` | leaked governance | fixed |
| `analysis_quality_food_metrics` | DEFINER | quality, suppliers, kitchen | leaked | fixed |
| `analysis_amr_susceptibility` | DEFINER | laboratory, surveillance | leaked | fixed |
| `analysis_microbiology_findings` | DEFINER | laboratory, surveillance | leaked | fixed |
| `platform_report_summary` | DEFINER | surveillance, laboratory, prevention, controls, quality, governance, pharmacy | leaked (occupational health already gated) | fixed |
| `executive_governance_status` | DEFINER | governance (committee decisions) | gated only by `view_executive_dashboard` | fixed (null when governance locked) |
| `document_acknowledgement_members` | DEFINER | governance (audience of controlled documents) | leaked member list | fixed (empty) |
| `surveillance_case_exposure_count` | DEFINER | occupational health | already checks the lock | unchanged |
| `department_register_fast_reads`, `employee_admin_history` | DEFINER | not module tables | n/a | unchanged |

Also the `analysis` module itself: all analysis RPCs now return empty when Analysis is locked.

## Accepted / not changed

* `training_assignments` is intentionally not gated (the employee record reads it), so the
  training counts stay in the staff analysis and report summary; they are zeroed only when
  Analysis is locked.
* Public-token functions (`survey_public`, `survey_submit`, `training_email_access`,
  `hr_application_*`, `quality_supplier_certificate_*`) serve people outside the hospital through
  a one-time link and are not module aggregates. Whether a link of a locked module should stop
  working is a product decision for the owner.
* Edge functions that use the service role (e-mail digests, reminders) were not audited here.

## Pending for the owner

`organizations_enabled_modules_check` (20261006090000) allows only ten module names in
`enabled_modules`; `kitchen`, `suppliers`, `interviews`, `analysis` and `executive` cannot be
stored, so a custom module set always locks them. Changing a constraint needs `drop constraint`,
which the agent does not run. Suggested SQL for the SQL Editor:

```sql
alter table public.organizations drop constraint organizations_enabled_modules_check;
alter table public.organizations add constraint organizations_enabled_modules_check
  check (enabled_modules is null or enabled_modules <@ array['patients','laboratory','national','surveillance','indicators','prevention','controls','quality','training','governance','kitchen','suppliers','interviews','analysis','executive']::text[]);
```

## Verification (production org 7972f286…, rolled-back transactions, hospital_admin)

* Unlocked: md5 of every function's output identical before and after the migration.
* Profile `surveillance` (locks controls, quality, governance, prevention, kitchen, suppliers,
  executive): surveillance, laboratory and antimicrobial numbers unchanged; the locked parts 0 / empty;
  `executive_governance_status` null.
* Module set `[patients, national]` (Analysis, laboratory, surveillance locked): everything 0.
