# Production migration reconciliation — 2026-09-03

Production project: `wnnssaicdsdgesysaamv`

Repository baseline: `exeltos/Limoxis-Observer` / `main`

## Source-of-truth rule

- Production Supabase is authoritative for **what has already been deployed**.
- GitHub `main` is authoritative for the **reproducible intended schema history**.
- A filename mismatch is not sufficient evidence that SQL is pending. Compare migration intent and resulting database state before applying anything.
- Do not use `supabase db push` against production while the items in the IND02 section below remain unresolved.

## Corrected interpretation of the reported 18 repo-only migrations

The reported 18 are 9 consolidation/renumbering/state-equivalent migrations plus 9 IND02 role/security migrations. They are not a single class of pending work.

### A. Consolidation / renumbering / state-equivalent — do not deploy as pending migrations

| Repository migration | Production reconciliation | Classification |
| --- | --- | --- |
| `202609010001_v0288_session_backend_fixes.sql` | Its four changes are represented by the production migrations `restore_platform_report_summary`, `fix_generate_username_whitespace_regex`, `add_missing_surveillance_write_policies`, and `extend_employees_frontend_fields`. | Superseded one-to-many |
| `202609010002_v0289_attachment_storage.sql` | Bucket/storage policy work and attachment metadata are represented by `create_attachments_storage_bucket` and `add_attachments_metadata_column`. | Superseded one-to-many |
| `202609010003_v0290_employee_subrecords.sql` | Employee training/evaluation/certificate tables are represented by production `employee_training_evaluations_certificates`. | State-equivalent; semantic tag collision |
| `202609010030_v0294_committee_workflow_alignment.sql` | This file explicitly consolidates committee hardening that production received as staged v0294+ migrations. Production contains the corresponding committee workflow, identity, approval, auto-finalize and attachment hardening sequence. | Consolidation; semantic tag collision |
| `202609020001_v0316_committee_minutes_transactional_submission.sql` | Production contains `committee_minutes_transactional_submission`. | Equivalent under different timestamp/name history |
| `202609020002_v0317_committee_history_finalize_capability.sql` | Production contains `committee_history_finalize_capability`. | Equivalent under different timestamp/name history |
| `20260902173000_retire_legacy_training_rpcs_and_harden_internal_functions.sql` | Production contains the work split across `harden_internal_function_execute_and_search_path` and `retire_legacy_training_rpcs`, followed by later corrective EXECUTE grants for RLS helpers. The repository consolidation represents the corrected intended end-state and must not be replayed as historical SQL. | Superseded by split migrations + corrective grants |
| `20260902204000_indicator_authorized_metric_rpc.sql` | Production contains `indicator_authorized_metric_rpc_v2`; the current production metric snapshot/RPC state represents this feature. | State-equivalent / superseded by v2 |
| `20260902150000_committee_framework_governance.sql` | Production currently has `committees_edit` with the same `status <> 'archived'` + `create_committee` governance condition. | State-equivalent even though migration-history naming differs |

### Known semantic-version collisions

`v0290` and `v0294` are genuine label collisions, not evidence that either SQL body should be replayed:

- repo `v0290_employee_subrecords` vs production `v0290_employee_domain_role_scope_hardening`
- repo `v0294_committee_workflow_alignment` vs production `v0294_committee_workflow_ui_fidelity`

Do not rename or replay already-deployed migrations merely to make semantic tags look sequential. Treat these labels as historical annotations; timestamp prefixes are the migration identifiers.

## B. IND02 role/security migrations — genuinely unapplied as authored

Production migration history does not contain these nine migrations, and their marker helper functions/triggers are not present in the production schema:

1. `20260902205000_indicator_role_scope_alignment.sql`
2. `20260902211500_workforce_role_scope_alignment.sql`
3. `20260902213000_laboratory_operational_scope_alignment.sql`
4. `20260902214500_surveillance_role_scope_alignment.sql`
5. `20260902215500_clinical_write_capability_alignment.sql`
6. `20260902220500_antimicrobial_therapy_role_alignment.sql`
7. `20260902222000_patient_surveillance_lifecycle_alignment.sql`
8. `20260902223500_employee_self_profile_rls.sql`
9. `20260902224500_surveillance_lifecycle_transition_guard.sql`

**Do not deploy these nine as a batch.** They were authored against assumptions that do not fully match the current production authorization layer.

### Blocking findings before IND02 deployment

#### 1. Clinical capability helper is incomplete for the proposed migrations

The current production `public.current_user_has_capability(uuid,text)` has explicit system-role mappings for only a limited set such as `view_training`, `manage_training`, `view_prevention`, `view_lab`, `manage_libraries`, `view_controls`, and `manage_controls` (plus custom/add-on capabilities).

The pending clinical migrations call capability keys including:

- `record_clinical_assessment`
- `manage_isolation`
- `reassess_surveillance`
- `record_surveillance_outcome`
- `manage_antimicrobial_therapy`
- `create_patient`, `edit_patient`, `delete_patient`
- `create_surveillance`, `edit_surveillance`, `delete_surveillance`
- `close_surveillance`, `reopen_surveillance`

Those keys are not currently mapped for system roles by the database helper. Applying the pending clinical migrations unchanged would therefore deny legitimate system-role workflows (except Platform Owner/custom-capability paths) instead of merely tightening scope.

**Required first:** make the database capability resolver match the canonical application role matrix, with tests.

#### 2. Workforce alignment would coexist with current permissive policy names

Production employee policies are currently named:

- `employees_select_authorized`
- `employees_insert_authorized`
- `employees_update_authorized`
- `employees_delete_authorized`

The pending workforce migration drops `employees_read` / `employees_write`, names that are not the active production policies, then creates new permissive policies. Because PostgreSQL permissive policies combine with OR semantics, replaying it unchanged would not reliably tighten existing access.

**Required first:** explicitly replace/audit all active employee policy names and preserve occupational-health separation.

#### 3. Laboratory alignment conflicts with the current application role model

The pending laboratory read helper includes hospital admin, IPC roles and laboratory, but omits `doctor_reviewer`, while the canonical frontend role matrix grants Doctor Reviewer `VIEW_LAB` for assigned clinical work. It therefore risks a functional authorization regression unless assignment-aware laboratory visibility is designed explicitly.

**Required first:** define Doctor Reviewer lab scope (assigned-case/sample linkage) and test it before replacing current policies.

#### 4. Surveillance/clinical alignment is security-relevant but depends on the capability resolver

Production `can_view_surveillance_record(uuid,uuid)` currently grants Doctor Reviewer role-level access without case assignment. The pending surveillance migration introduces case-aware assignment checks, which is directionally aligned with the intended model, but it must be deployed together with a correct capability resolver and tested policy replacement.

#### 5. Lifecycle transition guard is missing in production

The pending `surveillance_lifecycle_transition_guard` trigger/function is not currently present. This means close/reopen governance needs a dedicated hardening pass so generic UPDATE cannot bypass lifecycle-specific authorization. The migration depends on `current_user_can_surveillance_capability`, so it cannot safely be applied before the capability layer is corrected.

## Production corrections from the 2026-09-02 authorization incident

The following production migrations are intentional corrections and must remain part of the canonical end-state:

- `restore_platform_owner_organization_write_grants`
- `restore_rls_helper_execute_grants`
- `restore_remaining_rls_helper_execute_grants`
- `restore_all_rls_helper_execute_grants`

Reason: previous hardening revoked table privileges and/or EXECUTE on functions invoked by RLS. PostgreSQL policy evaluation still requires the invoking role to be allowed to execute those helper functions. Removing these corrective grants would reproduce the Platform Owner organization-creation failure and the Hospital Admin membership/menu 403 failure.

## Deployment decision

### Safe now

- Keep production schema unchanged.
- Keep the production corrective grants.
- Treat the nine group-A files as historical consolidation/state-equivalent artifacts, not pending production work.
- Enforce unique migration timestamp prefixes for future work.

### Requires a dedicated authorization patch before production

The nine IND02 migrations must be rewritten/rebased onto current production policy names and the canonical application role/capability matrix. The patch should be tested in this order:

1. canonical DB capability resolver parity with `src/core/permissions/systemRoleMatrix.js`;
2. workforce and employee self-profile policies;
3. laboratory assignment/scope policy;
4. surveillance read assignment scope;
5. clinical writes and antimicrobial therapy;
6. patient/surveillance lifecycle policies and lifecycle transition trigger;
7. indicator department-scope alignment;
8. role-by-role regression tests and RLS negative tests;
9. only then production migration.

## Migration hygiene rule going forward

- New migrations use a 14-digit `YYYYMMDDHHMMSS` prefix.
- Never make a production DDL/RLS change without committing its canonical migration to `main` in the same change window.
- Never infer deployment status from semantic tags such as `v0290`; use migration timestamp/history plus resulting schema state.
- A production drift check should compare `supabase_migrations.schema_migrations` against an explicit reconciliation manifest, because `supabase db pull` cannot reconstruct the original migration history one-by-one.
