create table public.patients (
  id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text,
  last_name text,
  father_name text,
  first_name_en text,
  last_name_en text,
  father_name_en text,
  name text not null,
  name_en text,
  hospital_record_number text,
  date_of_birth date,
  sex text,
  department text,
  department_en text,
  admission_date date not null,
  discharge_date date,
  status text not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

alter table public.patients enable row level security;

create policy patients_member_read on public.patients
  for select using (public.current_user_is_platform_owner() or public.is_org_member(organization_id));

create policy patients_member_write on public.patients
  for all
  using (public.current_user_is_platform_owner() or public.is_org_member(organization_id))
  with check (public.current_user_is_platform_owner() or public.is_org_member(organization_id));

create index patients_organization_id_idx on public.patients (organization_id);
