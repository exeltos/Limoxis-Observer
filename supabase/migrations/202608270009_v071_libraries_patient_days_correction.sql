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
