create table if not exists public.employee_surveillance_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_code text not null,
  department_id uuid references public.departments(id) on delete set null,
  started_at date not null,
  screening_types text[] not null default '{}',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,batch_code)
);
create index if not exists employee_surveillance_batches_org_date_idx on public.employee_surveillance_batches(organization_id,started_at desc);

create table if not exists public.employee_surveillance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_code text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  batch_id uuid references public.employee_surveillance_batches(id) on delete set null,
  started_at date not null,
  screening_types text[] not null default '{}',
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  result_status text not null default 'pending' check(result_status in ('pending','negative','positive','inconclusive')),
  intervention_status text not null default 'none' check(intervention_status in ('none','required','in_progress','completed')),
  recheck_due date,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,surveillance_code)
);
create index if not exists employee_surveillance_records_org_employee_idx on public.employee_surveillance_records(organization_id,employee_id,started_at desc);
create index if not exists employee_surveillance_records_batch_idx on public.employee_surveillance_records(batch_id);

alter table public.employee_surveillance_batches enable row level security;
alter table public.employee_surveillance_records enable row level security;

drop policy if exists employee_surveillance_batches_read on public.employee_surveillance_batches;
create policy employee_surveillance_batches_read on public.employee_surveillance_batches for select using(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_occupational_health')
);
drop policy if exists employee_surveillance_batches_write on public.employee_surveillance_batches;
create policy employee_surveillance_batches_write on public.employee_surveillance_batches for all using(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_occupational_health')
) with check(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_occupational_health')
);

drop policy if exists employee_surveillance_records_read on public.employee_surveillance_records;
create policy employee_surveillance_records_read on public.employee_surveillance_records for select using(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_occupational_health')
);
drop policy if exists employee_surveillance_records_write on public.employee_surveillance_records;
create policy employee_surveillance_records_write on public.employee_surveillance_records for all using(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_occupational_health')
) with check(
  public.current_user_has_org_role(organization_id,array['occupational_physician']::public.app_role[])
  or public.current_user_has_capability(organization_id,'manage_occupational_health')
);