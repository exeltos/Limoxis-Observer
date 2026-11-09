-- The monthly shift roster of a department (owner, 8/11/2026): its employees (active or not, leaves and wishes),
-- the people each shift needs, the rules, and the roster itself (one code per employee and day: M/A/N/R or a leave).
-- Made automatically in the browser (src/features/rosters/rosterEngine.js) and corrected by hand.
-- The department manager writes the roster of their own departments; the hospital administrator and the HR office
-- every department; the department's people read it.
create table if not exists public.department_rosters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  demand jsonb not null default '{"weekday":{"M":2,"A":2,"N":1},"weekend":{"M":2,"A":2,"N":1}}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  members jsonb not null default '[]'::jsonb,
  assignments jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint department_rosters_period check (period_end >= period_start and period_end - period_start <= 62),
  unique (organization_id, department_id, period_start)
);
create index if not exists department_rosters_org_department_idx on public.department_rosters (organization_id, department_id, period_start desc);

alter table public.department_rosters enable row level security;
revoke all on public.department_rosters from anon;
grant select, insert, update, delete on public.department_rosters to authenticated;

create policy department_rosters_read on public.department_rosters for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or public.current_user_has_org_role(organization_id, array['hr_office']::public.app_role[])
    or public.current_user_has_department_scope(organization_id, department_id)
  );
create policy department_rosters_write on public.department_rosters for all to authenticated
  using (
    public.is_org_admin(organization_id)
    or public.current_user_has_org_role(organization_id, array['hr_office']::public.app_role[])
    or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
  )
  with check (
    public.is_org_admin(organization_id)
    or public.current_user_has_org_role(organization_id, array['hr_office']::public.app_role[])
    or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
  );
