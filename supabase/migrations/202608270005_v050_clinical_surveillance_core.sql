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
