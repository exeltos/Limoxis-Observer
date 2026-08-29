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
