-- Limoxis Observer — Phase 3, batch 2 of 2: apply migrations 003 through 015.
--
-- Run this only after batch 1 (03_apply_migrations_batch1.sql) has been
-- committed successfully. Run this whole script in ONE execution in
-- Supabase SQL Editor (the editor closes its connection after each Run,
-- which silently rolls back an uncommitted transaction left open across two
-- separate executions).
--
-- v2: includes a fix for a real bug in migration 202608290014_v0271 —
-- it redefined current_user_has_capability(uuid, text) with a renamed
-- second parameter, which CREATE OR REPLACE FUNCTION rejects. This version
-- drops the old signature first. That fix has also been committed to
-- supabase/migrations/202608290014_v0271_data_access_foundation.sql in git.

begin;

do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'organizations') then
    raise exception 'Refusing to run: public.organizations does not exist — run batch 1 first.';
  end if;
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'demo'
  ) then
    raise exception 'Refusing to run: app_role enum is missing values from batch 1 — run batch 1 first.';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'laboratory_samples') then
    raise exception 'Refusing to run: public.laboratory_samples already exists — batch 2 looks already applied.';
  end if;
end $$;

-- ===== 202608270003_v030_access_scopes_assignments.sql =====
-- Limoxis Observer v0.3.0
-- Role + department scope + add-on capability + assignment foundation.
-- The database remains the final enforcement layer; UI visibility is not authorization.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_member_scopes (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.organization_members(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (membership_id, department_id)
);

create table if not exists public.organization_member_capabilities (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.organization_members(id) on delete cascade,
  capability text not null check (capability in (
    'hand_hygiene_observer','waste_management','committee_member','lira_access','lab_access','quality_access'
  )),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (membership_id, capability)
);

create table if not exists public.work_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null references public.organization_members(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  assignment_type text not null,
  source_type text,
  source_id uuid,
  title text not null,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled','overdue')),
  due_at timestamptz,
  assigned_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.current_membership_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select om.id
  from public.organization_members om
  where om.user_id = auth.uid() and om.status = 'active';
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'active'
  ) or public.current_user_is_platform_owner();
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'active'
      and om.role = 'hospital_admin'
  ) or public.current_user_is_platform_owner();
$$;

alter table public.departments enable row level security;
alter table public.organization_member_scopes enable row level security;
alter table public.organization_member_capabilities enable row level security;
alter table public.work_assignments enable row level security;

create policy "departments_view_org" on public.departments
for select using (public.is_org_member(organization_id));
create policy "departments_manage_admin" on public.departments
for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "member_scopes_read_own_or_admin" on public.organization_member_scopes
for select using (
  membership_id in (select public.current_membership_ids())
  or exists (
    select 1 from public.organization_members om
    where om.id = membership_id and public.is_org_admin(om.organization_id)
  )
);
create policy "member_scopes_manage_admin" on public.organization_member_scopes
for all using (
  exists (select 1 from public.organization_members om where om.id = membership_id and public.is_org_admin(om.organization_id))
) with check (
  exists (select 1 from public.organization_members om where om.id = membership_id and public.is_org_admin(om.organization_id))
);

create policy "member_capabilities_read_own_or_admin" on public.organization_member_capabilities
for select using (
  membership_id in (select public.current_membership_ids())
  or exists (
    select 1 from public.organization_members om
    where om.id = membership_id and public.is_org_admin(om.organization_id)
  )
);
create policy "member_capabilities_manage_admin" on public.organization_member_capabilities
for all using (
  exists (select 1 from public.organization_members om where om.id = membership_id and public.is_org_admin(om.organization_id))
) with check (
  exists (select 1 from public.organization_members om where om.id = membership_id and public.is_org_admin(om.organization_id))
);

create policy "assignments_read_assignee_or_admin" on public.work_assignments
for select using (
  membership_id in (select public.current_membership_ids())
  or public.is_org_admin(organization_id)
  or exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = work_assignments.organization_id
      and om.status = 'active'
      and om.role in ('infection_control_lead','quality_manager')
  )
);
create policy "assignments_manage_authorized" on public.work_assignments
for all using (
  public.is_org_admin(organization_id)
  or exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = work_assignments.organization_id
      and om.status = 'active'
      and om.role in ('infection_control_lead','quality_manager')
  )
) with check (
  public.is_org_admin(organization_id)
  or exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = work_assignments.organization_id
      and om.status = 'active'
      and om.role in ('infection_control_lead','quality_manager')
  )
);

create index if not exists idx_departments_org on public.departments(organization_id);
create index if not exists idx_member_scopes_membership on public.organization_member_scopes(membership_id);
create index if not exists idx_member_capabilities_membership on public.organization_member_capabilities(membership_id);
create index if not exists idx_work_assignments_membership_status on public.work_assignments(membership_id, status);
create index if not exists idx_work_assignments_org_due on public.work_assignments(organization_id, due_at);

-- ===== 202608270004_v040_patients_surveillance.sql =====
-- Limoxis Observer v0.4.0 — Patient & surveillance domain foundation
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_code text not null, first_name text, last_name text, date_of_birth date, department_id uuid references public.departments(id),
  admission_date date, discharge_date date, status text not null default 'active' check (status in ('active','discharged','deceased','transferred')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, patient_code)
);
create table if not exists public.surveillance_cases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict, department_id uuid references public.departments(id),
  status text not null default 'active' check (status in ('active','closed','cancelled')), started_at timestamptz not null default now(), closed_at timestamptz,
  close_reason text, created_by uuid references auth.users(id), closed_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.surveillance_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  event_type text not null check (event_type in ('clinical_assessment','sample','resistance_classification','antimicrobial_therapy','isolation','reassessment','outcome')),
  event_status text not null default 'pending' check (event_status in ('pending','in_progress','completed','cancelled','overdue')),
  occurred_at timestamptz, due_at timestamptz, payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id), completed_by uuid references auth.users(id), completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.patients enable row level security; alter table public.surveillance_cases enable row level security; alter table public.surveillance_events enable row level security;
create policy patients_tenant_read on public.patients for select using (public.is_org_member(organization_id));
create policy surveillance_tenant_read on public.surveillance_cases for select using (public.is_org_member(organization_id));
create policy surveillance_events_tenant_read on public.surveillance_events for select using (public.is_org_member(organization_id));
-- Write policies intentionally remain capability-specific and must be added through controlled RPCs in the next hardening pass.
create index if not exists patients_org_code_idx on public.patients(organization_id, patient_code);
create index if not exists surveillance_org_status_idx on public.surveillance_cases(organization_id, status);
create index if not exists surveillance_events_case_idx on public.surveillance_events(surveillance_case_id, event_type, event_status);

-- ===== 202608270005_v050_clinical_surveillance_core.sql =====
-- Limoxis Observer v0.5.0 — Clinical Surveillance Core
-- Canonical domain records + least-privilege RLS + metadata-only clinical audit trail.

create table if not exists public.clinical_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  assessment_type text not null check (assessment_type in ('suspected','healthcare_associated','community_associated','other')),
  classification text check (classification in ('infection','colonization','no_infection','undetermined')),
  signs_symptoms jsonb not null default '[]'::jsonb,
  risk_factors jsonb not null default '[]'::jsonb,
  summary text,
  assessed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.laboratory_samples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  surveillance_case_id uuid references public.surveillance_cases(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  sample_code text not null,
  sample_type text not null,
  source_site text,
  collected_at timestamptz not null,
  received_at timestamptz,
  status text not null default 'received' check (status in ('requested','collected','received','processing','completed','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (organization_id, sample_code)
);

create table if not exists public.microbiology_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sample_id uuid not null references public.laboratory_samples(id) on delete cascade,
  result_status text not null check (result_status in ('positive','negative','inconclusive','contaminated')),
  organism text,
  resistance_class text check (resistance_class in ('MDR','XDR','PDR') or resistance_class is null),
  susceptibility_summary text,
  is_critical boolean not null default false,
  critical_communicated_at timestamptz,
  critical_communicated_to text,
  resulted_at timestamptz not null default now(),
  validated_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (not is_critical or critical_communicated_at is not null)
);

create table if not exists public.antimicrobial_therapies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  surveillance_case_id uuid references public.surveillance_cases(id) on delete set null,
  antimicrobial text not null,
  dose text,
  route text,
  indication text,
  started_at timestamptz not null,
  planned_end_at timestamptz,
  ended_at timestamptz,
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected')),
  status text not null default 'active' check (status in ('planned','active','completed','stopped','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.isolation_episodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  precautions jsonb not null default '[]'::jsonb,
  room text,
  reason text not null,
  started_at timestamptz not null,
  review_due_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  status text not null default 'active' check (status in ('active','ended','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  ended_by uuid references auth.users(id)
);

create table if not exists public.surveillance_reassessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  clinical_status text not null check (clinical_status in ('improved','stable','deteriorated','resolved','undetermined')),
  isolation_decision text check (isolation_decision in ('continue','modify','discontinue','not_applicable')),
  therapy_decision text check (therapy_decision in ('continue','modify','stop','not_applicable')),
  notes text,
  reassessed_at timestamptz not null default now(),
  next_review_due_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.surveillance_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  outcome text not null check (outcome in ('ongoing','discharged','transferred','deceased','resolved','other')),
  occurred_at timestamptz not null,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (surveillance_case_id)
);

create table if not exists public.clinical_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now()
);

create or replace function public.current_user_has_org_role(target_org uuid, allowed_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_is_platform_owner() or exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid() and om.organization_id = target_org and om.status = 'active' and om.role = any(allowed_roles)
  );
$$;

create or replace function public.current_user_has_department_scope(target_org uuid, target_department uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organization_member_scopes oms on oms.membership_id = om.id
    where om.user_id = auth.uid() and om.organization_id = target_org and om.status = 'active' and oms.department_id = target_department
  );
$$;

create or replace function public.can_view_surveillance_record(target_org uuid, target_department uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_has_org_role(target_org, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
    or (
      public.current_user_has_org_role(target_org, array['department_manager']::public.app_role[])
      and target_department is not null
      and public.current_user_has_department_scope(target_org, target_department)
    );
$$;

-- Replace permissive v0.4 read policies with least-privilege clinical reads.
drop policy if exists patients_tenant_read on public.patients;
drop policy if exists surveillance_tenant_read on public.surveillance_cases;
drop policy if exists surveillance_events_tenant_read on public.surveillance_events;

create policy patients_clinical_read on public.patients for select using (
  public.can_view_surveillance_record(organization_id, department_id)
);
create policy surveillance_clinical_read on public.surveillance_cases for select using (
  public.can_view_surveillance_record(organization_id, department_id)
);
create policy surveillance_events_clinical_read on public.surveillance_events for select using (
  exists (
    select 1 from public.surveillance_cases sc
    where sc.id = surveillance_case_id and public.can_view_surveillance_record(sc.organization_id, sc.department_id)
  )
);

alter table public.clinical_assessments enable row level security;
alter table public.laboratory_samples enable row level security;
alter table public.microbiology_results enable row level security;
alter table public.antimicrobial_therapies enable row level security;
alter table public.isolation_episodes enable row level security;
alter table public.surveillance_reassessments enable row level security;
alter table public.surveillance_outcomes enable row level security;
alter table public.clinical_audit_log enable row level security;

create policy clinical_assessments_read on public.clinical_assessments for select using (public.can_view_surveillance_record(organization_id, department_id));
create policy clinical_assessments_write on public.clinical_assessments for all using (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
);

create policy laboratory_samples_read on public.laboratory_samples for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[])
  or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[]) and department_id is not null and public.current_user_has_department_scope(organization_id, department_id))
);
create policy laboratory_samples_write on public.laboratory_samples for all using (
  public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[])
);
create policy microbiology_results_read on public.microbiology_results for select using (
  exists (select 1 from public.laboratory_samples s where s.id = sample_id)
);
create policy microbiology_results_write on public.microbiology_results for all using (
  public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[])
);

create policy antimicrobial_therapies_read on public.antimicrobial_therapies for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','pharmacy','doctor_reviewer']::public.app_role[])
);
create policy antimicrobial_therapies_write on public.antimicrobial_therapies for all using (
  public.current_user_has_org_role(organization_id, array['pharmacy']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id, array['pharmacy']::public.app_role[])
);

create policy isolation_episodes_read on public.isolation_episodes for select using (public.can_view_surveillance_record(organization_id, department_id));
create policy isolation_episodes_write on public.isolation_episodes for all using (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member']::public.app_role[])
);

create policy reassessments_read on public.surveillance_reassessments for select using (
  exists (select 1 from public.surveillance_cases sc where sc.id = surveillance_case_id and public.can_view_surveillance_record(sc.organization_id, sc.department_id))
);
create policy reassessments_write on public.surveillance_reassessments for insert with check (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member']::public.app_role[])
);

create policy outcomes_read on public.surveillance_outcomes for select using (
  exists (select 1 from public.surveillance_cases sc where sc.id = surveillance_case_id and public.can_view_surveillance_record(sc.organization_id, sc.department_id))
);
create policy outcomes_write on public.surveillance_outcomes for all using (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','doctor_reviewer']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id, array['infection_control_lead','doctor_reviewer']::public.app_role[])
);

create policy clinical_audit_authorized_read on public.clinical_audit_log for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead']::public.app_role[])
);

create or replace function public.capture_clinical_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_org uuid;
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    target_org := old.organization_id;
    target_id := old.id;
  else
    target_org := new.organization_id;
    target_id := new.id;
  end if;
  insert into public.clinical_audit_log(organization_id, table_name, record_id, action, actor_id)
  values(target_org, tg_table_name, target_id, tg_op, auth.uid());
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_clinical_assessments after insert or update or delete on public.clinical_assessments for each row execute function public.capture_clinical_audit();
create trigger audit_laboratory_samples after insert or update or delete on public.laboratory_samples for each row execute function public.capture_clinical_audit();
create trigger audit_microbiology_results after insert or update or delete on public.microbiology_results for each row execute function public.capture_clinical_audit();
create trigger audit_antimicrobial_therapies after insert or update or delete on public.antimicrobial_therapies for each row execute function public.capture_clinical_audit();
create trigger audit_isolation_episodes after insert or update or delete on public.isolation_episodes for each row execute function public.capture_clinical_audit();
create trigger audit_surveillance_reassessments after insert or update or delete on public.surveillance_reassessments for each row execute function public.capture_clinical_audit();
create trigger audit_surveillance_outcomes after insert or update or delete on public.surveillance_outcomes for each row execute function public.capture_clinical_audit();

create index if not exists clinical_assessments_case_idx on public.clinical_assessments(surveillance_case_id, assessed_at desc);
create index if not exists laboratory_samples_patient_idx on public.laboratory_samples(organization_id, patient_id, collected_at desc);
create index if not exists laboratory_samples_case_idx on public.laboratory_samples(surveillance_case_id, collected_at desc);
create index if not exists microbiology_results_sample_idx on public.microbiology_results(sample_id, resulted_at desc);
create index if not exists antimicrobial_therapies_case_idx on public.antimicrobial_therapies(surveillance_case_id, status);
create index if not exists isolation_episodes_case_idx on public.isolation_episodes(surveillance_case_id, status);
create index if not exists reassessments_case_idx on public.surveillance_reassessments(surveillance_case_id, reassessed_at desc);
create index if not exists clinical_audit_record_idx on public.clinical_audit_log(organization_id, table_name, record_id, occurred_at desc);

-- ===== 202608270006_v051_parallel_surveillance.sql =====
-- Limoxis Observer v0.5.1 — Parallel Surveillance Model
-- HAI classification and device/risk-factor evidence. AMR remains laboratory-derived, not a workflow stage.

create table if not exists public.hai_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  case_status text not null check (case_status in ('suspected','probable','confirmed','excluded','undetermined')),
  hai_type text not null,
  definition_set text not null,
  definition_version text,
  criteria_met boolean,
  criteria_evidence jsonb not null default '[]'::jsonb,
  rationale text,
  classified_at timestamptz not null default now(),
  classified_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.surveillance_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null references public.surveillance_cases(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  device_type text not null,
  site text,
  indication text,
  inserted_at timestamptz,
  review_due_at timestamptz,
  removed_at timestamptz,
  status text not null default 'active' check (status in ('active','removed','unknown')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.hai_classifications enable row level security;
alter table public.surveillance_devices enable row level security;

create policy hai_classification_read on public.hai_classifications for select using (
  exists (select 1 from public.surveillance_cases sc where sc.id=surveillance_case_id and public.can_view_surveillance_record(sc.organization_id,sc.department_id))
);
create policy hai_classification_write on public.hai_classifications for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
);

create policy surveillance_devices_read on public.surveillance_devices for select using (
  public.can_view_surveillance_record(organization_id,department_id)
);
create policy surveillance_devices_write on public.surveillance_devices for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
) with check (
  public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
);

create index if not exists hai_classifications_case_idx on public.hai_classifications(surveillance_case_id,classified_at desc);
create index if not exists surveillance_devices_case_idx on public.surveillance_devices(surveillance_case_id,status);

-- ===== 202608270007_v060_laboratory_microbiology.sql =====
-- Limoxis Observer v0.6.0 — Laboratory & Microbiology Core
-- Structured AST, validation, critical-result communication and versioned AMR classification.

alter table public.laboratory_samples
  add column if not exists requested_at timestamptz,
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists priority text not null default 'routine' check (priority in ('routine','urgent','critical')),
  add column if not exists specimen_condition text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.microbiology_results
  add column if not exists method text,
  add column if not exists preliminary boolean not null default false,
  add column if not exists validation_status text not null default 'draft' check (validation_status in ('draft','validated','amended')),
  add column if not exists validated_at timestamptz,
  add column if not exists amended_from uuid references public.microbiology_results(id),
  add column if not exists interpretation_standard text,
  add column if not exists interpretation_version text;

create table if not exists public.antimicrobial_susceptibility_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  microbiology_result_id uuid not null references public.microbiology_results(id) on delete cascade,
  antimicrobial_code text,
  antimicrobial_name text not null,
  method text not null,
  mic_value numeric,
  mic_operator text check (mic_operator in ('<','<=','=','>=','>') or mic_operator is null),
  zone_diameter_mm numeric,
  sir_category text not null check (sir_category in ('S','I','R')),
  breakpoint_standard text not null default 'EUCAST',
  breakpoint_version text not null,
  technical_uncertainty boolean not null default false,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (microbiology_result_id, antimicrobial_name)
);

create table if not exists public.amr_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  microbiology_result_id uuid not null references public.microbiology_results(id) on delete cascade,
  classification text check (classification in ('MDR','XDR','PDR') or classification is null),
  definition_source text not null,
  definition_version text not null,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','reviewed','confirmed','overridden')),
  rationale text,
  classified_by uuid references auth.users(id),
  classified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.critical_result_communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  microbiology_result_id uuid not null references public.microbiology_results(id) on delete cascade,
  communicated_at timestamptz not null,
  communicated_by uuid not null references auth.users(id),
  recipient_name text not null,
  recipient_role text,
  communication_method text not null check (communication_method in ('phone','in_person','secure_message','other')),
  read_back_confirmed boolean,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.antimicrobial_susceptibility_results enable row level security;
alter table public.amr_classifications enable row level security;
alter table public.critical_result_communications enable row level security;

create policy ast_authorized_read on public.antimicrobial_susceptibility_results for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[])
);
create policy ast_lab_write on public.antimicrobial_susceptibility_results for all using (
  public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[]));

create policy amr_authorized_read on public.amr_classifications for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[])
);
create policy amr_lab_ipc_write on public.amr_classifications for all using (
  public.current_user_has_org_role(organization_id, array['laboratory','infection_control_lead','infection_control_member']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id, array['laboratory','infection_control_lead','infection_control_member']::public.app_role[]));

create policy critical_comm_authorized_read on public.critical_result_communications for select using (
  public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::public.app_role[])
);
create policy critical_comm_lab_write on public.critical_result_communications for insert with check (
  public.current_user_has_org_role(organization_id, array['laboratory']::public.app_role[])
);

create index if not exists idx_lab_samples_org_status on public.laboratory_samples(organization_id,status,collected_at desc);
create index if not exists idx_micro_results_sample on public.microbiology_results(sample_id,resulted_at desc);
create index if not exists idx_ast_result on public.antimicrobial_susceptibility_results(microbiology_result_id);
create index if not exists idx_critical_comm_result on public.critical_result_communications(microbiology_result_id,communicated_at desc);

-- Legacy critical communication columns remain readable during migration, but new writes use
-- critical_result_communications so repeated/escalated communications are preserved rather than overwritten.

-- ===== 202608270008_v070_product_foundation.sql =====
-- Limoxis Observer v0.7.0 — product foundation
-- Shared attachments, custom role bundles, governed indicators, patient-days and external reference versions.

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, description text, is_active boolean not null default true, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,name)
);
create table if not exists public.custom_role_capabilities (
  id uuid primary key default gen_random_uuid(), custom_role_id uuid not null references public.custom_roles(id) on delete cascade,
  capability text not null, created_at timestamptz not null default now(), unique(custom_role_id,capability)
);
alter table public.organization_members add column if not exists custom_role_id uuid references public.custom_roles(id) on delete set null;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null, entity_id text not null, file_name text not null, storage_path text not null, mime_type text, size_bytes bigint,
  uploaded_by uuid references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz
);
create index if not exists attachments_entity_idx on public.attachments(organization_id,entity_type,entity_id) where deleted_at is null;

create table if not exists public.patient_days (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade, census_date date not null, patient_days integer not null check(patient_days>=0),
  source text not null check(source in ('calculated','imported','manual')), review_status text not null default 'locked' check(review_status in ('locked','reviewable','approved')),
  source_reference text, calculated_at timestamptz, created_by uuid references auth.users(id), updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,department_id,census_date)
);
create index if not exists patient_days_period_idx on public.patient_days(organization_id,census_date,department_id);

create table if not exists public.indicator_definitions (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  indicator_key text not null, version text not null, title_el text not null, title_en text not null, category text not null,
  numerator_definition jsonb not null default '{}'::jsonb, denominator_definition jsonb not null default '{}'::jsonb, multiplier numeric not null default 1,
  unit text, source_authority text, effective_from date, effective_to date, status text not null default 'draft' check(status in ('draft','review','active','retired')),
  created_by uuid references auth.users(id), approved_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(organization_id,indicator_key,version)
);

create table if not exists public.external_reference_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  source_key text not null, authority text not null, title text not null, source_url text, version_label text, published_at date, checked_at timestamptz,
  status text not null default 'pending_review' check(status in ('pending_review','approved','superseded','rejected')),
  metadata jsonb not null default '{}'::jsonb, reviewed_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(organization_id,source_key,version_label)
);

alter table public.custom_roles enable row level security; alter table public.custom_role_capabilities enable row level security; alter table public.attachments enable row level security; alter table public.patient_days enable row level security; alter table public.indicator_definitions enable row level security; alter table public.external_reference_versions enable row level security;

create policy custom_roles_read on public.custom_roles for select using(public.is_org_member(organization_id));
create policy custom_roles_admin on public.custom_roles for all using(public.is_org_admin(organization_id)) with check(public.is_org_admin(organization_id));
create policy custom_role_caps_read on public.custom_role_capabilities for select using(exists(select 1 from public.custom_roles r where r.id=custom_role_id and public.is_org_member(r.organization_id)));
create policy custom_role_caps_admin on public.custom_role_capabilities for all using(exists(select 1 from public.custom_roles r where r.id=custom_role_id and public.is_org_admin(r.organization_id))) with check(exists(select 1 from public.custom_roles r where r.id=custom_role_id and public.is_org_admin(r.organization_id)));
create policy attachments_read on public.attachments for select using(public.is_org_member(organization_id));
create policy attachments_write on public.attachments for insert with check(public.is_org_member(organization_id) and uploaded_by=auth.uid());
create policy patient_days_read on public.patient_days for select using(public.is_org_member(organization_id));
create policy patient_days_manage on public.patient_days for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[])) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[]));
create policy indicators_read on public.indicator_definitions for select using(organization_id is null or public.is_org_member(organization_id));
create policy indicators_manage on public.indicator_definitions for all using(organization_id is not null and public.is_org_admin(organization_id)) with check(organization_id is not null and public.is_org_admin(organization_id));
create policy external_refs_read on public.external_reference_versions for select using(organization_id is null or public.is_org_member(organization_id));
create policy external_refs_manage on public.external_reference_versions for all using(organization_id is not null and public.is_org_admin(organization_id)) with check(organization_id is not null and public.is_org_admin(organization_id));

-- Automatic daily patient-day generation from the patient registry.
-- Manual/imported rows are never silently overwritten.
create or replace function public.generate_patient_days(target_org uuid, target_date date default current_date)
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  if not (public.is_org_admin(target_org) or public.current_user_has_org_role(target_org,array['infection_control_lead']::public.app_role[])) then
    raise exception 'permission denied';
  end if;
  insert into public.patient_days(organization_id,department_id,census_date,patient_days,source,review_status,source_reference,calculated_at,created_by,updated_by)
  select target_org,p.department_id,target_date,count(*)::integer,'calculated','locked','patients registry',now(),auth.uid(),auth.uid()
  from public.patients p
  where p.organization_id=target_org and p.department_id is not null and p.admission_date<=target_date and (p.discharge_date is null or p.discharge_date>=target_date)
  group by p.department_id
  on conflict(organization_id,department_id,census_date) do update set patient_days=excluded.patient_days,calculated_at=now(),updated_at=now(),updated_by=auth.uid()
  where public.patient_days.source='calculated';
  get diagnostics affected=row_count;
  return affected;
end;$$;

-- Always-current calculated patient-days. Stored rows in public.patient_days act as governed overrides/imports.
create or replace view public.calculated_patient_days with (security_invoker=true) as
select p.organization_id,p.department_id,d.day::date as census_date,count(*)::integer as patient_days,'calculated'::text as source,'locked'::text as review_status
from public.patients p
cross join lateral generate_series(p.admission_date,coalesce(p.discharge_date,current_date),'1 day'::interval) d(day)
where p.department_id is not null and p.admission_date is not null
group by p.organization_id,p.department_id,d.day::date;

create or replace view public.effective_patient_days with (security_invoker=true) as
select c.organization_id,c.department_id,c.census_date,coalesce(o.patient_days,c.patient_days) as patient_days,coalesce(o.source,c.source) as source,coalesce(o.review_status,c.review_status) as review_status
from public.calculated_patient_days c
left join public.patient_days o on o.organization_id=c.organization_id and o.department_id=c.department_id and o.census_date=c.census_date
union all
select o.organization_id,o.department_id,o.census_date,o.patient_days,o.source,o.review_status
from public.patient_days o
where not exists(select 1 from public.calculated_patient_days c where c.organization_id=o.organization_id and c.department_id=o.department_id and c.census_date=o.census_date);

-- ===== 202608270009_v071_libraries_patient_days_correction.sql =====
-- Limoxis Observer v0.7.1 — governed libraries and patient-day denominator correction.
-- Patient-days are NOT inferred from the surveillance-patient registry.

drop view if exists public.effective_patient_days;
drop view if exists public.calculated_patient_days;
drop function if exists public.generate_patient_days(uuid,date);

create table if not exists public.master_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  library_key text not null,
  code text,
  name_el text not null,
  name_en text,
  category text,
  metadata jsonb not null default '{}'::jsonb,
  source_authority text,
  source_version text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,library_key,name_el)
);
create index if not exists master_library_items_lookup_idx on public.master_library_items(organization_id,library_key,is_active);
alter table public.master_library_items enable row level security;
create policy master_library_items_read on public.master_library_items for select using(public.is_org_member(organization_id));
create policy master_library_items_manage on public.master_library_items for all using(public.is_org_admin(organization_id)) with check(public.is_org_admin(organization_id));

create table if not exists public.patient_day_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  patient_days integer not null check(patient_days >= 0),
  source text not null default 'manual' check(source in ('manual','imported')),
  source_reference text,
  review_status text not null default 'approved' check(review_status in ('reviewable','approved','locked')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(period_end >= period_start)
);
create index if not exists patient_day_periods_idx on public.patient_day_periods(organization_id,period_start,period_end,department_id);
alter table public.patient_day_periods enable row level security;
create policy patient_day_periods_read on public.patient_day_periods for select using(public.is_org_member(organization_id));
create policy patient_day_periods_manage on public.patient_day_periods for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[])) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead']::public.app_role[]));

comment on table public.patient_day_periods is 'Governed patient-day denominators supplied manually or by trusted import. department_id NULL means whole-hospital total for the period.';
comment on table public.patient_days is 'Deprecated v0.7.0 daily model. Do not populate from surveillance patients; use patient_day_periods.';

-- ===== 202608270010_v080_prevention_core.sql =====
-- Limoxis Observer v0.8.0 — Prevention Core
-- WHO hand-hygiene observations, waste, antiseptic consumption and prevention bundles.


create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_platform_owner() or exists(
    select 1
    from public.organization_members om
    left join public.organization_member_capabilities mc on mc.membership_id=om.id
    left join public.custom_role_capabilities crc on crc.custom_role_id=om.custom_role_id
    where om.user_id=auth.uid() and om.organization_id=target_org and om.status='active'
      and (mc.capability=capability_key or crc.capability=capability_key)
  );
$$;

create table if not exists public.hand_hygiene_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  observation_date date not null,
  professional_category text,
  observations integer not null default 0 check(observations >= 0),
  compliant_observations integer not null default 0 check(compliant_observations >= 0),
  observer_id uuid references auth.users(id),
  source_standard text not null default 'WHO',
  source_version text,
  status text not null default 'completed' check(status in ('draft','completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(compliant_observations <= observations)
);
create index if not exists hand_hygiene_sessions_idx on public.hand_hygiene_sessions(organization_id,observation_date,department_id);

create table if not exists public.waste_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  record_date date not null,
  waste_type_id uuid references public.master_library_items(id) on delete set null,
  weight_kg numeric(12,3) not null check(weight_kg >= 0),
  containers integer check(containers is null or containers >= 0),
  document_number text,
  collection_company text,
  status text not null default 'completed' check(status in ('draft','completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists waste_measurements_idx on public.waste_measurements(organization_id,record_date,department_id);

create table if not exists public.antiseptic_consumption_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  period_start date not null,
  period_end date not null,
  antiseptic_item_id uuid references public.master_library_items(id) on delete set null,
  litres numeric(12,3) not null check(litres >= 0),
  source text not null default 'manual' check(source in ('manual','imported')),
  source_reference text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(period_end >= period_start)
);
create index if not exists antiseptic_consumption_idx on public.antiseptic_consumption_periods(organization_id,period_start,period_end,department_id);

create table if not exists public.prevention_bundle_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  bundle_key text not null,
  assessment_date date not null,
  period_label text,
  score numeric(5,2) check(score is null or (score >= 0 and score <= 100)),
  criteria jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check(status in ('draft','completed','cancelled')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prevention_bundle_idx on public.prevention_bundle_assessments(organization_id,assessment_date,department_id,bundle_key);

alter table public.hand_hygiene_sessions enable row level security;
alter table public.waste_measurements enable row level security;
alter table public.antiseptic_consumption_periods enable row level security;
alter table public.prevention_bundle_assessments enable row level security;

create policy hand_hygiene_read on public.hand_hygiene_sessions for select using(public.is_org_member(organization_id));
create policy hand_hygiene_write on public.hand_hygiene_sessions for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'hand_hygiene_observer') or public.current_user_has_capability(organization_id,'record_hand_hygiene')) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'hand_hygiene_observer') or public.current_user_has_capability(organization_id,'record_hand_hygiene'));
create policy waste_read on public.waste_measurements for select using(public.is_org_member(organization_id));
create policy waste_write on public.waste_measurements for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'waste_management') or public.current_user_has_capability(organization_id,'record_waste')) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'waste_management') or public.current_user_has_capability(organization_id,'record_waste'));
create policy antiseptic_read on public.antiseptic_consumption_periods for select using(public.is_org_member(organization_id));
create policy antiseptic_write on public.antiseptic_consumption_periods for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'record_antiseptic')) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'record_antiseptic'));
create policy bundles_read on public.prevention_bundle_assessments for select using(public.is_org_member(organization_id));
create policy bundles_write on public.prevention_bundle_assessments for all using(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'record_prevention_bundle')) with check(public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member']::public.app_role[]) or public.current_user_has_capability(organization_id,'record_prevention_bundle'));

-- ===== 202608270011_v090_workforce_occupational_health.sql =====
-- Limoxis Observer v0.9.0 — Workforce & Occupational Health
-- Administrative employee identity is deliberately separated from occupational-health clinical data.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_code text not null,
  first_name text not null,
  last_name text not null,
  department_id uuid references public.departments(id) on delete set null,
  professional_category_id uuid references public.master_library_items(id) on delete set null,
  employment_status text not null default 'active' check(employment_status in ('active','inactive','leave')),
  hire_date date,
  email text,
  phone text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,employee_code)
);
create index if not exists employees_org_department_idx on public.employees(organization_id,department_id,employment_status);

create table if not exists public.occupational_health_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  visit_date date not null,
  visit_type text not null,
  status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
  fitness_status text check(fitness_status in ('fit','fit_with_restrictions','unfit','pending')),
  follow_up_date date,
  clinical_notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists occupational_health_visits_idx on public.occupational_health_visits(organization_id,employee_id,visit_date);

create table if not exists public.employee_vaccinations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  vaccine_item_id uuid references public.master_library_items(id) on delete set null,
  vaccine_label_snapshot text not null,
  dose text,
  vaccination_date date not null,
  lot_number text,
  valid_until date,
  status text not null default 'complete' check(status in ('complete','renew_soon','overdue','declined','contraindicated')),
  clinical_notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employee_vaccinations_idx on public.employee_vaccinations(organization_id,employee_id,vaccination_date);

alter table public.employees enable row level security;
alter table public.occupational_health_visits enable row level security;
alter table public.employee_vaccinations enable row level security;

-- Administrative registry: HR/admin or users with explicit staff-administration capability.
create policy employees_read on public.employees for select using(
  public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id,array['hr_office','occupational_physician','infection_control_lead']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_staff_admin')
  or public.current_user_has_capability(organization_id,'manage_occupational_health')
);
create policy employees_write on public.employees for all using(
  public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_staff_admin')
) with check(
  public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_staff_admin')
);

-- Clinical workforce data: never granted by HR administration alone.
create policy occupational_visits_read on public.occupational_health_visits for select using(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
);
create policy occupational_visits_write on public.occupational_health_visits for all using(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
) with check(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
);
create policy employee_vaccinations_read on public.employee_vaccinations for select using(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
);
create policy employee_vaccinations_write on public.employee_vaccinations for all using(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
) with check(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
);

-- ===== 202608270012_v0106_surveillance_reopen.sql =====
-- Limoxis Observer v0.10.6
-- Reopening a completed surveillance episode is a restricted governance action.
-- Application authorization grants this only to the platform/super administrator.

alter table if exists public.surveillance_cases
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid,
  add column if not exists reopen_reason text;

create or replace function public.reopen_surveillance_episode(
  p_case_id text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'Reopen reason is required';
  end if;

  update public.surveillance_cases
     set status = 'active',
         reopened_at = now(),
         reopened_by = auth.uid(),
         reopen_reason = p_reason,
         updated_at = now()
   where id = p_case_id
     and status <> 'active';

  insert into public.clinical_audit_log
    (organization_id, entity_type, entity_id, action, actor_id, metadata)
  select organization_id,
         'surveillance_case',
         id,
         'surveillance_reopened',
         auth.uid(),
         jsonb_build_object('reason',p_reason,'previous_status','completed')
    from public.surveillance_cases
   where id = p_case_id;
end;
$$;

-- ===== 202608270013_v0120_quality_capa_audits.sql =====
-- Limoxis Observer v0.12.0 — Quality, Incidents, Findings, CAPA & Audits

create table if not exists public.quality_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  department_id uuid,
  occurred_at timestamptz not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'reported' check (status in ('reported','under_review','closed')),
  description text,
  reported_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  linked_patient_id uuid,
  linked_surveillance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code)
);

create table if not exists public.quality_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  audit_type text not null check (audit_type in ('internal','external')),
  department_id uuid,
  scope text,
  planned_date date,
  completed_date date,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  lead_auditor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code)
);

create table if not exists public.quality_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  department_id uuid,
  identified_at timestamptz not null default now(),
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  description text,
  source_type text not null check (source_type in ('manual','incident','audit','control','other')),
  source_id text,
  owner_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code)
);

create table if not exists public.quality_capa_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  department_id uuid,
  source_type text not null check (source_type in ('incident','finding','audit','control','other')),
  source_id text,
  action_type text not null check (action_type in ('corrective','preventive')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','verification','closed')),
  description text,
  owner_id uuid references auth.users(id),
  due_date date,
  effectiveness_due date,
  effectiveness_status text default 'pending' check (effectiveness_status in ('pending','effective','not_effective')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,code)
);

create table if not exists public.quality_record_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  target_type text not null,
  target_id text not null,
  relationship text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.quality_incidents enable row level security;
alter table public.quality_audits enable row level security;
alter table public.quality_findings enable row level security;
alter table public.quality_capa_actions enable row level security;
alter table public.quality_record_links enable row level security;

create policy quality_incident_org_read on public.quality_incidents for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);
create policy quality_incident_report on public.quality_incidents for insert with check (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','pharmacy','hr_office','occupational_physician','doctor_reviewer']::public.app_role[])
);
create policy quality_incident_manage on public.quality_incidents for update using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));

create policy quality_audit_manage on public.quality_audits for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));
create policy quality_audit_authorized_read on public.quality_audits for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);

create policy quality_finding_manage on public.quality_findings for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));
create policy quality_finding_authorized_read on public.quality_findings for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);

create policy quality_capa_manage on public.quality_capa_actions for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));
create policy quality_capa_authorized_read on public.quality_capa_actions for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);

create policy quality_links_authorized on public.quality_record_links for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead','department_manager']::public.app_role[])
);
create policy quality_links_manage on public.quality_record_links for all using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[])
) with check (public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager']::public.app_role[]));

create index if not exists idx_quality_incidents_org_status on public.quality_incidents(organization_id,status,occurred_at desc);
create index if not exists idx_quality_findings_org_status on public.quality_findings(organization_id,status,identified_at desc);
create index if not exists idx_quality_capa_org_status_due on public.quality_capa_actions(organization_id,status,due_date);
create index if not exists idx_quality_audits_org_status on public.quality_audits(organization_id,status,planned_date);

-- ===== 202608290014_v0271_data_access_foundation.sql =====
-- Limoxis Observer v0.27.1
-- Data-access foundation: Training, Environmental Standards, Control Drafts.
-- RLS mirrors current frontend role/scope intent instead of relying on UI hiding.

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_key text not null,
  record_type text not null default 'state',
  department_id uuid references public.departments(id) on delete set null,
  employee_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,record_key)
);

create table if not exists public.environmental_standards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,record_key)
);

create table if not exists public.control_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_key text not null,
  control_id text,
  department_id uuid references public.departments(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  payload jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,record_key)
);

create index if not exists idx_training_records_org_type on public.training_records(organization_id,record_type);
create index if not exists idx_training_records_scope on public.training_records(organization_id,department_id,employee_user_id);
create index if not exists idx_environmental_standards_org on public.environmental_standards(organization_id);
create index if not exists idx_control_drafts_owner on public.control_drafts(organization_id,created_by,saved_at desc);
create index if not exists idx_control_drafts_department on public.control_drafts(organization_id,department_id);


-- Capability bridge for RLS.
-- The frontend remains responsible for UX, but authorization is repeated here.
-- Custom-role capabilities and add-on grants are included so UI capability grants do not bypass DB enforcement.
-- The v0.8.0 version of this function named its second parameter capability_key;
-- CREATE OR REPLACE cannot rename an existing parameter, so drop it first.
drop function if exists public.current_user_has_capability(uuid, text);
create or replace function public.current_user_has_capability(target_org uuid, requested_capability text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.current_user_is_platform_owner()
  or exists (
    select 1
    from public.organization_members om
    where om.user_id=auth.uid()
      and om.organization_id=target_org
      and om.status='active'
      and (
        exists (
          select 1
          from public.custom_role_capabilities crc
          where crc.custom_role_id=om.custom_role_id
            and crc.capability=requested_capability
        )
        or exists (
          select 1
          from public.organization_member_capabilities omc
          where omc.membership_id=om.id
            and (
              (omc.capability='lab_access' and requested_capability='view_lab')
              or (omc.capability='quality_access' and requested_capability in ('view_quality','view_controls'))
            )
        )
        or case requested_capability
          when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','hr_office')
          when 'manage_training' then om.role in ('hospital_admin')
          when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory')
          when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
          when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          else false
        end
      )
  );
$$;

alter table public.training_records enable row level security;
alter table public.environmental_standards enable row level security;
alter table public.control_drafts enable row level security;

-- Training
-- Full hospital-wide training visibility: Hospital Admin + IPC Lead.
-- HR may view workforce training.
-- Department managers/users only receive department-scoped training records.
-- Individual employee-linked records are visible to that authenticated employee.
create policy training_records_read on public.training_records
for select using (
  (record_type='program' and public.is_org_member(organization_id))
  or public.current_user_has_org_role(
    organization_id,
    array['hospital_admin','infection_control_lead','infection_control_member','hr_office']::public.app_role[]
  )
  or (
    department_id is not null
    and public.current_user_has_org_role(
      organization_id,
      array['department_manager','department_user']::public.app_role[]
    )
    and public.current_user_has_department_scope(organization_id,department_id)
  )
  or employee_user_id = auth.uid()
);

-- Current frontend MANAGE_TRAINING is granted to Hospital Admin.
create policy training_records_manage on public.training_records
for all using (
  public.current_user_has_capability(organization_id,'manage_training')
) with check (
  public.current_user_has_capability(organization_id,'manage_training')
);

-- Environmental standards are consumed by IPC and Laboratory workflows.
create policy environmental_standards_read on public.environmental_standards
for select using (
  public.current_user_has_org_role(
    organization_id,
    array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[]
  )
);

-- Current frontend library-management authority: Hospital Admin / Infection Control Lead.
create policy environmental_standards_manage on public.environmental_standards
for all using (
  public.current_user_has_capability(organization_id,'manage_libraries')
) with check (
  public.current_user_has_capability(organization_id,'manage_libraries')
);

-- Control drafts are private working data by default.
-- The creator can always read/update/delete their own draft.
-- Hospital/Quality managers may manage all.
-- Department managers may access drafts only inside their assigned department.
create policy control_drafts_read on public.control_drafts
for select using (
  created_by = auth.uid()
  or public.current_user_has_capability(organization_id,'manage_controls')
  or (
    department_id is not null
    and public.current_user_has_org_role(
      organization_id,
      array['department_manager']::public.app_role[]
    )
    and public.current_user_has_department_scope(organization_id,department_id)
  )
);

create policy control_drafts_insert on public.control_drafts
for insert with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
  and (
    department_id is null
    or public.current_user_has_capability(organization_id,'manage_controls')
    or public.current_user_has_department_scope(organization_id,department_id)
  )
);

create policy control_drafts_update on public.control_drafts
for update using (
  created_by = auth.uid()
  or public.current_user_has_capability(organization_id,'manage_controls')
) with check (
  created_by = auth.uid()
  or public.current_user_has_capability(organization_id,'manage_controls')
);

create policy control_drafts_delete on public.control_drafts
for delete using (
  created_by = auth.uid()
  or public.current_user_has_capability(organization_id,'manage_controls')
);

-- Force server-owned actor/timestamps on cloud writes.
create or replace function public.set_repository_audit_fields()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at = now();
  if tg_op='INSERT' then
    if to_jsonb(new) ? 'created_by' and new.created_by is null then new.created_by = auth.uid(); end if;
    if to_jsonb(new) ? 'updated_by' and new.updated_by is null then new.updated_by = auth.uid(); end if;
  else
    if to_jsonb(new) ? 'updated_by' then new.updated_by = auth.uid(); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_training_records_audit on public.training_records;
create trigger trg_training_records_audit before insert or update on public.training_records
for each row execute function public.set_repository_audit_fields();

drop trigger if exists trg_environmental_standards_audit on public.environmental_standards;
create trigger trg_environmental_standards_audit before insert or update on public.environmental_standards
for each row execute function public.set_repository_audit_fields();

-- ===== 202608300015_v0272_governance_schema_coverage.sql =====
-- Limoxis Observer v0.27.2
-- Governance schema coverage: committees, controlled documents and controls.
-- Also tightens Quality RLS and removes obsolete Laboratory artefacts.

-- The capability bridge is deliberately kept in the database: UI visibility is not authorization.
create or replace function public.current_user_has_governance_capability(target_org uuid, requested_capability text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select not public.current_user_is_platform_owner() and (
  public.current_user_has_capability(target_org,requested_capability)
  or exists (
    select 1 from public.organization_members om
    where om.organization_id=target_org and om.user_id=auth.uid() and om.status='active'
      and case requested_capability
        when 'view_committees' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','quality_manager')
        when 'manage_committees' then om.role in ('hospital_admin','infection_control_lead')
        when 'create_committee' then om.role in ('hospital_admin','infection_control_lead')
        when 'manage_committee_members' then om.role in ('hospital_admin','infection_control_lead')
        when 'create_committee_meeting' then om.role in ('hospital_admin','infection_control_lead')
        when 'edit_committee_minutes' then om.role in ('hospital_admin','infection_control_lead')
        when 'finalize_committee_minutes' then om.role in ('hospital_admin','infection_control_lead')
        when 'manage_committee_decisions' then om.role in ('hospital_admin','infection_control_lead')
        when 'manage_committee_documents' then om.role in ('hospital_admin','infection_control_lead')
        when 'archive_committee' then om.role in ('hospital_admin','infection_control_lead')
        when 'view_documents' then true
        when 'manage_documents' then om.role in ('hospital_admin','quality_manager')
        when 'submit_document_review' then om.role in ('hospital_admin','quality_manager')
        when 'approve_document' then om.role in ('hospital_admin','quality_manager')
        when 'publish_document' then om.role in ('hospital_admin','quality_manager')
        when 'supersede_document' then om.role in ('hospital_admin','quality_manager')
        when 'archive_document' then om.role in ('hospital_admin','quality_manager')
        when 'delete_document_draft' then om.role in ('hospital_admin','quality_manager')
        when 'execute_control' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
        when 'edit_control_definition' then om.role in ('hospital_admin','infection_control_lead','department_manager','quality_manager')
        when 'edit_control_execution' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
        when 'void_control_execution' then om.role in ('hospital_admin','infection_control_lead','department_manager','quality_manager')
        when 'archive_control_definition' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
        when 'delete_control_draft' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
        else false
      end
  ));
$$;

-- Secretariat authority is record-assigned, never organization-wide. An assignment
-- supplements a capability; it cannot grant committee creation or archival authority.
create or replace function public.current_user_can_manage_committee(target_org uuid,target_committee uuid,requested_capability text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_has_governance_capability(target_org,requested_capability)
  or (
    requested_capability in ('manage_committee_members','create_committee_meeting','edit_committee_minutes','finalize_committee_minutes','manage_committee_decisions','manage_committee_documents')
    and exists (
      select 1
      from public.organization_members om
      join public.work_assignments wa on wa.membership_id=om.id and wa.organization_id=om.organization_id
      where om.organization_id=target_org and om.user_id=auth.uid() and om.status='active'
        and om.role::text='committee_secretariat'
        and wa.source_type='committee' and wa.source_id=target_committee
        and wa.status in ('open','in_progress','overdue')
    )
  );
$$;

create or replace function public.current_user_can_view_committee(target_org uuid,target_committee uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_has_governance_capability(target_org,'view_committees')
  or public.current_user_can_manage_committee(target_org,target_committee,'edit_committee_minutes');
$$;

create or replace function public.current_user_can_access_control_department(target_org uuid,target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select not public.current_user_is_platform_owner() and (
    public.current_user_has_org_role(target_org,array['hospital_admin','infection_control_lead','infection_control_member','laboratory','quality_manager']::public.app_role[])
    or (target_department is not null and public.current_user_has_department_scope(target_org,target_department))
  );
$$;

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  short_name text,
  committee_type text not null default 'custom',
  status text not null default 'active' check (status in ('draft','active','inactive','archived')),
  mandate text,
  legal_basis text,
  decision_number text,
  term_start date,
  term_end date,
  meeting_frequency text,
  quorum_rule text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code),
  check (term_end is null or term_start is null or term_end >= term_start)
);

create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  member_name text not null,
  title text not null,
  responsibilities text,
  member_type text not null default 'regular' check (member_type in ('regular','alternate','observer','advisor')),
  has_vote boolean not null default true,
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected')),
  started_at date,
  ended_at date,
  created_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table public.committee_meetings (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  status text not null default 'planned' check (status in ('draft','planned','in_progress','approval_pending','finalized','cancelled')),
  minutes_number text,
  quorum_met boolean,
  agenda jsonb not null default '[]'::jsonb,
  minutes text,
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committee_decisions (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  meeting_id uuid references public.committee_meetings(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  action text,
  owner_id uuid references auth.users(id) on delete set null,
  due_date date,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committee_meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid references public.committee_members(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  attendee_name text not null,
  attendance_status text not null default 'not_recorded' check (attendance_status in ('not_recorded','present','absent','excused')),
  has_vote boolean not null default true,
  recorded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_id,member_id)
);

create table public.committee_minutes_approvals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approver_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references public.committee_members(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  comment text,
  requested_by uuid not null default auth.uid() references auth.users(id),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_id,approver_id)
);

create table public.committee_plan_items (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  indicator text,
  baseline text,
  target text,
  owner_id uuid references auth.users(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.committee_documents (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid,
  document_kind text not null default 'evidence' check (document_kind in ('establishment','agenda','minutes','decision','evidence','other')),
  attachment jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (document_id is not null or attachment is not null)
);

create table public.committee_history (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null,
  reason text,
  event_data jsonb not null default '{}'::jsonb,
  actor_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.controlled_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  document_type text not null,
  department_id uuid references public.departments(id) on delete set null,
  audience text not null default 'organization' check (audience in ('organization','department','restricted')),
  status text not null default 'draft' check (status in ('draft','review','approved','published','superseded','archived')),
  version text not null default '0.1',
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  revision_of_id uuid references public.controlled_documents(id) on delete set null,
  supersedes_id uuid references public.controlled_documents(id) on delete set null,
  effective_date date,
  review_date date,
  published_at timestamptz,
  published_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code,version),
  check (review_date is null or effective_date is null or review_date >= effective_date)
);

create table public.document_approvals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  approver_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique(document_id,step_number)
);

create table public.control_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  category text not null,
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  response_config jsonb not null default '{}'::jsonb,
  frequency_config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft','active','inactive','archived')),
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,code)
);

create table public.control_assignments (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.control_definitions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  last_completed_at timestamptz,
  next_due_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','due','overdue','paused')),
  unique(control_id,department_id)
);

create table public.control_executions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.control_assignments(id) on delete restrict,
  control_id uuid not null references public.control_definitions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  status text not null default 'completed' check (status in ('completed','cancelled')),
  value_text text,
  response_data jsonb not null default '{}'::jsonb,
  notes text,
  has_finding boolean not null default false,
  performed_at timestamptz not null default now(),
  performed_by uuid not null default auth.uid() references auth.users(id),
  edited_at timestamptz,
  edited_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  check (status <> 'cancelled' or (cancelled_at is not null and cancellation_reason is not null))
);

create table public.control_execution_revisions (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.control_executions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  before_data jsonb not null,
  after_data jsonb not null,
  reason text,
  changed_by uuid not null default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);

-- Composite tenant keys prevent a child row from naming a parent in another organization.
alter table public.committees add constraint committees_id_org_key unique(id,organization_id);
alter table public.committee_members add constraint committee_members_id_org_committee_key unique(id,organization_id,committee_id);
alter table public.committee_meetings add constraint committee_meetings_id_org_key unique(id,organization_id);
alter table public.committee_meetings add constraint committee_meetings_id_org_committee_key unique(id,organization_id,committee_id);
alter table public.controlled_documents add constraint controlled_documents_id_org_key unique(id,organization_id);
alter table public.control_definitions add constraint control_definitions_id_org_key unique(id,organization_id);
alter table public.control_assignments add constraint control_assignments_id_org_key unique(id,organization_id);
alter table public.control_assignments add constraint control_assignments_execution_key unique(id,organization_id,control_id,department_id);
alter table public.control_executions add constraint control_executions_id_org_key unique(id,organization_id);
alter table public.committee_members add constraint committee_members_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_meetings add constraint committee_meetings_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_decisions add constraint committee_decisions_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_decisions add constraint committee_decisions_meeting_tenant_fk foreign key(meeting_id,organization_id) references public.committee_meetings(id,organization_id);
alter table public.committee_meeting_attendance add constraint committee_attendance_meeting_tenant_fk foreign key(meeting_id,organization_id,committee_id) references public.committee_meetings(id,organization_id,committee_id) on delete cascade;
alter table public.committee_meeting_attendance add constraint committee_attendance_member_tenant_fk foreign key(member_id,organization_id,committee_id) references public.committee_members(id,organization_id,committee_id) on delete set null (member_id);
alter table public.committee_minutes_approvals add constraint committee_minutes_approvals_meeting_tenant_fk foreign key(meeting_id,organization_id,committee_id) references public.committee_meetings(id,organization_id,committee_id) on delete cascade;
alter table public.committee_minutes_approvals add constraint committee_minutes_approvals_member_tenant_fk foreign key(member_id,organization_id,committee_id) references public.committee_members(id,organization_id,committee_id) on delete set null (member_id);
alter table public.committee_plan_items add constraint committee_plan_items_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_documents add constraint committee_documents_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.committee_documents add constraint committee_documents_document_tenant_fk foreign key(document_id,organization_id) references public.controlled_documents(id,organization_id) on delete cascade;
alter table public.committee_history add constraint committee_history_tenant_fk foreign key(committee_id,organization_id) references public.committees(id,organization_id) on delete cascade;
alter table public.document_approvals add constraint document_approvals_tenant_fk foreign key(document_id,organization_id) references public.controlled_documents(id,organization_id) on delete cascade;
alter table public.control_assignments add constraint control_assignments_tenant_fk foreign key(control_id,organization_id) references public.control_definitions(id,organization_id) on delete cascade;
alter table public.control_executions add constraint control_executions_assignment_tenant_fk foreign key(assignment_id,organization_id,control_id,department_id) references public.control_assignments(id,organization_id,control_id,department_id);
alter table public.control_executions add constraint control_executions_definition_tenant_fk foreign key(control_id,organization_id) references public.control_definitions(id,organization_id);
alter table public.control_execution_revisions add constraint control_revisions_tenant_fk foreign key(execution_id,organization_id) references public.control_executions(id,organization_id) on delete cascade;

create index committees_org_status_idx on public.committees(organization_id,status);
create index committee_meetings_due_idx on public.committee_meetings(organization_id,scheduled_at desc);
create index committee_decisions_due_idx on public.committee_decisions(organization_id,status,due_date);
create index committee_attendance_meeting_idx on public.committee_meeting_attendance(organization_id,committee_id,meeting_id);
create index committee_minutes_approvals_status_idx on public.committee_minutes_approvals(organization_id,committee_id,status);
create index committee_plan_items_due_idx on public.committee_plan_items(organization_id,committee_id,status,due_date);
create index committee_documents_committee_idx on public.committee_documents(organization_id,committee_id,document_kind);
create index committee_history_committee_idx on public.committee_history(organization_id,committee_id,created_at desc);
create index documents_org_status_idx on public.controlled_documents(organization_id,status,review_date);
create index control_definitions_org_status_idx on public.control_definitions(organization_id,status);
create index control_assignments_due_idx on public.control_assignments(organization_id,department_id,next_due_at);
create index control_executions_history_idx on public.control_executions(control_id,department_id,performed_at desc);

alter table public.committees enable row level security;
alter table public.committee_members enable row level security;
alter table public.committee_meetings enable row level security;
alter table public.committee_decisions enable row level security;
alter table public.committee_meeting_attendance enable row level security;
alter table public.committee_minutes_approvals enable row level security;
alter table public.committee_plan_items enable row level security;
alter table public.committee_documents enable row level security;
alter table public.committee_history enable row level security;
alter table public.controlled_documents enable row level security;
alter table public.document_approvals enable row level security;
alter table public.control_definitions enable row level security;
alter table public.control_assignments enable row level security;
alter table public.control_executions enable row level security;
alter table public.control_execution_revisions enable row level security;

-- Committee policies mirror the explicit frontend lifecycle capabilities. Assignment
-- checks are tied to committee_id and cannot be reused against another committee.
create policy committees_read on public.committees for select using (
  public.current_user_can_view_committee(organization_id,id)
);
create policy committees_insert on public.committees for insert with check (
  status in ('draft','active') and public.current_user_has_governance_capability(organization_id,'create_committee')
);
create policy committees_edit on public.committees for update using (
  status<>'archived' and public.current_user_has_governance_capability(organization_id,'create_committee')
) with check (
  status<>'archived' and public.current_user_has_governance_capability(organization_id,'create_committee')
);
create policy committees_archive on public.committees for update using (
  status<>'archived' and public.current_user_has_governance_capability(organization_id,'archive_committee')
) with check (
  status='archived' and public.current_user_has_governance_capability(organization_id,'archive_committee')
);

create policy committee_members_read on public.committee_members for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_members_manage on public.committee_members for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_members')
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_members')
);

create policy committee_meetings_read on public.committee_meetings for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_meetings_insert on public.committee_meetings for insert with check (
  status in ('draft','planned') and public.current_user_can_manage_committee(organization_id,committee_id,'create_committee_meeting')
);
create policy committee_meetings_edit_minutes on public.committee_meetings for update using (
  status in ('draft','planned','in_progress') and public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
) with check (
  status in ('draft','planned','in_progress') and public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
);
create policy committee_meetings_finalize on public.committee_meetings for update using (
  status in ('draft','planned','in_progress') and public.current_user_can_manage_committee(organization_id,committee_id,'finalize_committee_minutes')
) with check (
  status in ('approval_pending','finalized') and (status='approval_pending' or finalized_at is not null)
  and public.current_user_can_manage_committee(organization_id,committee_id,'finalize_committee_minutes')
);

create policy committee_decisions_read on public.committee_decisions for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_decisions_manage on public.committee_decisions for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
);

create policy committee_attendance_read on public.committee_meeting_attendance for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_attendance_manage on public.committee_meeting_attendance for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
  and exists (select 1 from public.committee_meetings m where m.id=meeting_id and m.organization_id=organization_id and m.committee_id=committee_id and m.status in ('draft','planned','in_progress'))
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
  and exists (select 1 from public.committee_meetings m where m.id=meeting_id and m.organization_id=organization_id and m.committee_id=committee_id and m.status in ('draft','planned','in_progress'))
);

create policy committee_minutes_approvals_read on public.committee_minutes_approvals for select using (
  approver_id=auth.uid() or public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_minutes_approvals_request on public.committee_minutes_approvals for insert with check (
  status='pending' and public.current_user_can_manage_committee(organization_id,committee_id,'finalize_committee_minutes')
);
create policy committee_minutes_approvals_decide on public.committee_minutes_approvals for update using (
  approver_id=auth.uid() and status='pending'
) with check (
  approver_id=auth.uid() and status in ('approved','rejected') and decided_at is not null
);

create policy committee_plan_items_read on public.committee_plan_items for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_plan_items_manage on public.committee_plan_items for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
);

create policy committee_documents_read on public.committee_documents for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_documents_manage on public.committee_documents for all using (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_documents')
) with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_documents')
);

create policy committee_history_read on public.committee_history for select using (
  public.current_user_can_view_committee(organization_id,committee_id)
);
create policy committee_history_append on public.committee_history for insert with check (
  public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_members')
  or public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')
  or public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_decisions')
  or public.current_user_can_manage_committee(organization_id,committee_id,'manage_committee_documents')
);

create policy document_approvals_read on public.document_approvals for select using (
  approver_id=auth.uid() or public.current_user_has_governance_capability(organization_id,'view_documents')
);
create policy document_approvals_request on public.document_approvals for insert with check (
  status='pending' and public.current_user_has_governance_capability(organization_id,'submit_document_review')
);
create policy document_approvals_decide on public.document_approvals for update using (
  approver_id=auth.uid() and status='pending'
  and public.current_user_has_governance_capability(organization_id,'approve_document')
) with check (
  approver_id=auth.uid() and status in ('approved','rejected') and decided_at is not null
  and public.current_user_has_governance_capability(organization_id,'approve_document')
);

create policy controlled_documents_read on public.controlled_documents for select using (
  public.current_user_has_governance_capability(organization_id,'view_documents')
);
create policy controlled_documents_insert on public.controlled_documents for insert with check (
  status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents')
);
create policy controlled_documents_edit_draft on public.controlled_documents for update using (
  status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents')
) with check (
  status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents')
);
create policy controlled_documents_submit_review on public.controlled_documents for update using (
  status='draft' and public.current_user_has_governance_capability(organization_id,'submit_document_review')
) with check (
  status='review' and public.current_user_has_governance_capability(organization_id,'submit_document_review')
);
create policy controlled_documents_approve on public.controlled_documents for update using (
  status='review' and public.current_user_has_governance_capability(organization_id,'approve_document')
) with check (
  status='approved' and public.current_user_has_governance_capability(organization_id,'approve_document')
);
create policy controlled_documents_publish on public.controlled_documents for update using (
  status='approved' and public.current_user_has_governance_capability(organization_id,'publish_document')
) with check (
  status='published' and public.current_user_has_governance_capability(organization_id,'publish_document')
);
create policy controlled_documents_archive on public.controlled_documents for update using (
  status='published' and public.current_user_has_governance_capability(organization_id,'archive_document')
) with check (
  status='archived' and public.current_user_has_governance_capability(organization_id,'archive_document')
);
create policy controlled_documents_supersede on public.controlled_documents for update using (
  status='published' and public.current_user_has_governance_capability(organization_id,'supersede_document')
) with check (
  status='superseded' and public.current_user_has_governance_capability(organization_id,'supersede_document')
);
create policy controlled_documents_delete_draft on public.controlled_documents for delete using (
  status='draft' and public.current_user_has_governance_capability(organization_id,'delete_document_draft')
);

create policy control_definitions_read on public.control_definitions for select
using (public.current_user_has_capability(organization_id,'view_controls'));
create policy control_definitions_manage on public.control_definitions for all
using (public.current_user_has_capability(organization_id,'manage_controls'))
with check (public.current_user_has_capability(organization_id,'manage_controls'));
create policy control_assignments_read on public.control_assignments for select using (
  public.current_user_has_capability(organization_id,'view_controls')
  and public.current_user_can_access_control_department(organization_id,department_id)
);
create policy control_assignments_manage on public.control_assignments for all
using (public.current_user_has_capability(organization_id,'manage_controls'))
with check (public.current_user_has_capability(organization_id,'manage_controls'));
create policy control_executions_read on public.control_executions for select using (
  public.current_user_has_capability(organization_id,'view_controls')
  and public.current_user_can_access_control_department(organization_id,department_id)
);
create policy control_executions_insert on public.control_executions for insert with check (
  performed_by=auth.uid() and public.current_user_has_governance_capability(organization_id,'execute_control')
  and public.current_user_can_access_control_department(organization_id,department_id)
);
create policy control_executions_edit on public.control_executions for update using (
  status='completed' and public.current_user_has_governance_capability(organization_id,'edit_control_execution')
  and (performed_by=auth.uid() or public.current_user_has_capability(organization_id,'manage_controls'))
) with check (
  status='completed' and public.current_user_has_governance_capability(organization_id,'edit_control_execution')
);
create policy control_executions_void on public.control_executions for update using (
  status='completed' and public.current_user_has_governance_capability(organization_id,'void_control_execution')
) with check (
  status='cancelled' and cancelled_at is not null and nullif(trim(cancellation_reason),'') is not null
  and public.current_user_has_governance_capability(organization_id,'void_control_execution')
);
create policy control_revisions_read on public.control_execution_revisions for select using (
  exists (
    select 1 from public.control_executions execution
    where execution.id=control_execution_revisions.execution_id
      and execution.organization_id=control_execution_revisions.organization_id
  )
);
create policy control_revisions_insert on public.control_execution_revisions for insert with check (
  changed_by=auth.uid()
  and exists (
    select 1 from public.control_executions execution
    where execution.id=control_execution_revisions.execution_id
      and execution.organization_id=control_execution_revisions.organization_id
      and (execution.performed_by=auth.uid() or public.current_user_has_capability(control_execution_revisions.organization_id,'manage_controls'))
  )
);

-- Quality fix: reporters can see their report; department roles only see their assigned scope.
drop policy if exists quality_incident_org_read on public.quality_incidents;
create policy quality_incident_org_read on public.quality_incidents for select using (
  reported_by=auth.uid()
  or public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
  or (department_id is not null
      and public.current_user_has_org_role(organization_id,array['department_manager']::public.app_role[])
      and public.current_user_has_department_scope(organization_id,department_id))
);

-- Apply the same department boundary to the rest of Quality. The original policies
-- granted every department manager hospital-wide visibility.
drop policy if exists quality_audit_authorized_read on public.quality_audits;
create policy quality_audit_authorized_read on public.quality_audits for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
  or (department_id is not null
      and public.current_user_has_org_role(organization_id,array['department_manager']::public.app_role[])
      and public.current_user_has_department_scope(organization_id,department_id))
);
drop policy if exists quality_finding_authorized_read on public.quality_findings;
create policy quality_finding_authorized_read on public.quality_findings for select using (
  owner_id=auth.uid()
  or public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
  or (department_id is not null
      and public.current_user_has_org_role(organization_id,array['department_manager']::public.app_role[])
      and public.current_user_has_department_scope(organization_id,department_id))
);
drop policy if exists quality_capa_authorized_read on public.quality_capa_actions;
create policy quality_capa_authorized_read on public.quality_capa_actions for select using (
  owner_id=auth.uid()
  or public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
  or (department_id is not null
      and public.current_user_has_org_role(organization_id,array['department_manager']::public.app_role[])
      and public.current_user_has_department_scope(organization_id,department_id))
);
drop policy if exists quality_links_authorized on public.quality_record_links;
create policy quality_links_authorized on public.quality_record_links for select using (
  public.current_user_has_org_role(organization_id,array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
);

-- Laboratory cleanup: these indexes duplicate the canonical indexes created by v0.5.0.
drop index if exists public.idx_lab_samples_org_status;
drop index if exists public.idx_micro_results_sample;

-- Shared audit trigger keeps mutable governance records server-authored.
create or replace function public.protect_committee_minutes_approval_identity()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.id<>old.id or new.organization_id<>old.organization_id or new.committee_id<>old.committee_id
     or new.meeting_id<>old.meeting_id or new.approver_id<>old.approver_id
     or new.requested_by<>old.requested_by or new.requested_at<>old.requested_at then
    raise exception 'Committee minutes approval identity is immutable';
  end if;
  return new;
end;
$$;

create or replace function public.protect_document_approval_identity()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.id<>old.id or new.organization_id<>old.organization_id or new.document_id<>old.document_id
     or new.step_number<>old.step_number or new.approver_id is distinct from old.approver_id
     or new.created_at<>old.created_at then
    raise exception 'Document approval identity is immutable';
  end if;
  return new;
end;
$$;

create trigger trg_committees_audit before insert or update on public.committees
for each row execute function public.set_repository_audit_fields();
create trigger trg_committee_meetings_audit before insert or update on public.committee_meetings
for each row execute function public.set_repository_audit_fields();
create trigger trg_committee_attendance_audit before insert or update on public.committee_meeting_attendance
for each row execute function public.set_repository_audit_fields();
create trigger trg_committee_minutes_approvals_audit before insert or update on public.committee_minutes_approvals
for each row execute function public.set_repository_audit_fields();
create trigger trg_committee_minutes_approvals_identity before update on public.committee_minutes_approvals
for each row execute function public.protect_committee_minutes_approval_identity();
create trigger trg_committee_plan_items_audit before insert or update on public.committee_plan_items
for each row execute function public.set_repository_audit_fields();
create trigger trg_documents_audit before insert or update on public.controlled_documents
for each row execute function public.set_repository_audit_fields();
create trigger trg_document_approvals_identity before update on public.document_approvals
for each row execute function public.protect_document_approval_identity();
create trigger trg_control_definitions_audit before insert or update on public.control_definitions
for each row execute function public.set_repository_audit_fields();


select 'batch 2 tables created' as check, count(*) as value
from pg_tables where schemaname = 'public'
union all
select 'RLS-enabled tables', count(*)
from pg_tables where schemaname = 'public' and rowsecurity = true;

select tablename from pg_tables where schemaname = 'public' order by tablename;

commit;
