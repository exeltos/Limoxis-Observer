-- Limoxis Observer v0.29.0
-- Three of the five Employees sub-record tabs (training summary,
-- evaluations, certificates) had no real table at all — unlike
-- occupational_health_visits and employee_vaccinations (both v0.9.0), which
-- already existed. These are administrative/HR records about staff
-- development, not clinical medical data, so RLS mirrors public.employees'
-- own read/write pattern (hr_office/manage_staff_admin) rather than the
-- stricter occupational_physician-only pattern used for clinical workforce
-- data. Note: public.employees has no user_id linking a row to a login
-- account (it's an administrative registry, not tied 1:1 to auth.users), so
-- there is no "employee sees their own record" self-read clause here —
-- matches the parent employees_read policy's own role/capability-only shape.

create table if not exists public.employee_training_summary (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  title_en text,
  training_date date not null,
  status text not null default 'completed' check (status in ('completed','scheduled','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employee_training_summary_employee_idx on public.employee_training_summary(organization_id,employee_id,training_date desc);

create table if not exists public.employee_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  title_en text,
  evaluation_date date not null,
  result text,
  result_en text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employee_evaluations_employee_idx on public.employee_evaluations(organization_id,employee_id,evaluation_date desc);

create table if not exists public.employee_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  title_en text,
  issuer text,
  issue_date date,
  valid_until date,
  certificate_number text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or issue_date is null or valid_until >= issue_date)
);
create index if not exists employee_certificates_employee_idx on public.employee_certificates(organization_id,employee_id);

alter table public.employee_training_summary enable row level security;
alter table public.employee_evaluations enable row level security;
alter table public.employee_certificates enable row level security;

create policy employee_training_summary_read on public.employee_training_summary for select using (
  public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id,array['hr_office','occupational_physician','infection_control_lead']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_staff_admin')
);
create policy employee_training_summary_write on public.employee_training_summary for all using (
  public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_staff_admin')
) with check (
  public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_staff_admin')
);

create policy employee_evaluations_read on public.employee_evaluations for select using (
  public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id,array['hr_office','occupational_physician','infection_control_lead']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_staff_admin')
);
create policy employee_evaluations_write on public.employee_evaluations for all using (
  public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_staff_admin')
) with check (
  public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_staff_admin')
);

create policy employee_certificates_read on public.employee_certificates for select using (
  public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id,array['hr_office','occupational_physician','infection_control_lead']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_staff_admin')
);
create policy employee_certificates_write on public.employee_certificates for all using (
  public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_staff_admin')
) with check (
  public.is_org_admin(organization_id) or public.current_user_has_org_role(organization_id,array['hr_office']::public.app_role[]) or public.current_user_has_capability(organization_id,'manage_staff_admin')
);
