-- Occupational exposure / needlestick-injury tracking for Personnel.
-- Flagged by the platform review as completely missing: staff who sustain a
-- sharps injury or mucocutaneous exposure have nowhere in the product to
-- record it, despite this being a core occupational-health surveillance
-- requirement (post-exposure prophylaxis timelines, follow-up serology).
--
-- This is clinical occupational-health data, so RLS mirrors
-- occupational_health_visits/employee_vaccinations (202608270011): only the
-- occupational_physician role or an explicit manage_occupational_health
-- capability grant can read or write it — never HR/Admin by default.

create table if not exists public.occupational_exposure_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  incident_date date not null,
  exposure_type text not null check (exposure_type in ('needlestick','sharps_object','mucocutaneous','non_intact_skin','other')),
  device_or_source text,
  body_site text,
  source_patient_status text check (source_patient_status in ('unknown','negative','hbv_positive','hcv_positive','hiv_positive','other')),
  reported_at timestamptz not null default now(),
  pep_administered boolean,
  pep_details text,
  follow_up_status text not null default 'pending' check (follow_up_status in ('pending','scheduled','completed','closed')),
  follow_up_due_at date,
  notes text,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists occupational_exposure_incidents_idx on public.occupational_exposure_incidents(organization_id,employee_id,incident_date desc);

alter table public.occupational_exposure_incidents enable row level security;

create policy occupational_exposure_incidents_read on public.occupational_exposure_incidents for select using (
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
);
create policy occupational_exposure_incidents_write on public.occupational_exposure_incidents for all using (
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
) with check (
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_occupational_health')
);
