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
