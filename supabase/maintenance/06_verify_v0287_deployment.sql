-- Limoxis Observer v0.28.7 — read-only post-deployment verification.
--
-- Run the whole file in Supabase SQL Editor after applying migrations 0285-0287.
-- It deliberately uses PostgreSQL catalogs instead of selecting from the
-- removed demo_entitlements table, so an already-clean database cannot raise
-- 42P01 (undefined_table).

with expected_constraints(name) as (
  values
    ('patient_admissions_status_check'),
    ('patient_admissions_date_range_check'),
    ('patients_status_check'),
    ('patients_admission_date_range_check'),
    ('patient_admissions_patient_organization_fk'),
    ('patient_admissions_department_organization_fk')
),
constraint_status as (
  select
    e.name,
    exists (
      select 1
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' and c.conname = e.name
    ) as installed
  from expected_constraints e
),
deployment as (
  select jsonb_build_object(
    'legacy_demo_entitlements_removed', to_regclass('public.demo_entitlements') is null,
    'canonical_demo_entitlements_present', to_regclass('public.platform_demo_entitlements') is not null,
    'patient_admissions_present', to_regclass('public.patient_admissions') is not null,
    'atomic_admission_rpc_present', to_regprocedure('public.create_patient_admission(uuid,uuid,uuid,date,date,text,text)') is not null,
    'initial_admission_trigger_present', exists (
      select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'patients'
        and t.tgname = 'patients_create_initial_admission'
        and not t.tgisinternal
    ),
    'constraints', (
      select jsonb_object_agg(name, installed order by name)
      from constraint_status
    ),
    'all_constraints_present', coalesce(bool_and(installed), false)
  ) as report
  from constraint_status
)
select report as v0287_deployment_verification
from deployment;
