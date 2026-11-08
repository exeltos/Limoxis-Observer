-- Shift roster, second round (owner, 8/11/2026): the department's people ask for leave, a day off, a day they cannot
-- work or a swap with a colleague; the department manager (or the hospital administrator) approves or rejects.
-- A published roster keeps a log of every change made after publishing.
create table if not exists public.roster_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null default auth.uid(),
  kind text not null check (kind in ('leave','sick','unpaid','wish','unavailable','swap')),
  date_from date not null,
  date_to date,
  swap_employee_id uuid references public.employees(id) on delete cascade,
  swap_date date,
  note text check (note is null or length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint roster_requests_range check (date_to is null or (date_to >= date_from and date_to - date_from <= 62)),
  constraint roster_requests_swap check ((kind = 'swap') = (swap_employee_id is not null))
);
create index if not exists roster_requests_org_department_idx on public.roster_requests (organization_id, department_id, date_from);
create index if not exists roster_requests_employee_idx on public.roster_requests (employee_id);

alter table public.roster_requests enable row level security;
revoke all on public.roster_requests from anon;
grant select, insert, update on public.roster_requests to authenticated;

-- Who decides: the hospital administrator, or the department manager of that department.
create policy roster_requests_manager_all on public.roster_requests for all to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
  )
  with check (
    public.is_org_admin(organization_id)
    or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
  );
-- The employee: reads their own requests and those that name them in a swap; asks only as themselves, pending.
create policy roster_requests_own_read on public.roster_requests for select to authenticated
  using (exists (select 1 from public.employees e where e.user_id = auth.uid() and e.organization_id = roster_requests.organization_id
                 and (e.id = roster_requests.employee_id or e.id = roster_requests.swap_employee_id)));
create policy roster_requests_own_insert on public.roster_requests for insert to authenticated
  with check (status = 'pending' and decided_by is null
    and exists (select 1 from public.employees e where e.user_id = auth.uid() and e.id = roster_requests.employee_id
                and e.organization_id = roster_requests.organization_id)
    and public.current_user_has_department_scope(organization_id, department_id));
-- ...and may withdraw a pending one (nothing else).
create policy roster_requests_own_cancel on public.roster_requests for update to authenticated
  using (status = 'pending' and exists (select 1 from public.employees e where e.user_id = auth.uid() and e.id = roster_requests.employee_id))
  with check (status = 'cancelled' and decided_by is null
    and exists (select 1 from public.employees e where e.user_id = auth.uid() and e.id = roster_requests.employee_id));

-- Changes after publishing: [{at, by, employeeId, date, from, to}].
alter table public.department_rosters add column if not exists change_log jsonb not null default '[]'::jsonb;
alter table public.department_rosters add column if not exists published_at timestamptz;
