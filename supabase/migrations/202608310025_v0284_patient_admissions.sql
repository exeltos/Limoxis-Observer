-- A patient can be hospitalized more than once (e.g. recurring hemodialysis
-- admissions). The patients table keeps identity + the current/latest
-- admission snapshot (used everywhere lists filter by department/status);
-- this table holds the full chronological admission history.
create table public.patient_admissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  department_id uuid references public.departments(id),
  admission_date date not null,
  discharge_date date,
  status text not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patient_admissions enable row level security;

create policy patient_admissions_read on public.patient_admissions
  for select using (public.can_view_surveillance_record(organization_id, department_id));

create policy patient_admissions_write on public.patient_admissions
  for all
  using (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))
  with check (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]));

create index patient_admissions_patient_id_idx on public.patient_admissions (patient_id);
