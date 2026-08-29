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
