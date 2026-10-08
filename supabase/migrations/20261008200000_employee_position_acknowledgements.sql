-- Employee acknowledgement of their job description.
--
-- The job description lives with the job position (master_library_items,
-- library_key 'positions', metadata.jobDescription, versioned). Each time an
-- employee accepts the description of their position, one row records which
-- position and which version, and when. Rows are never updated or deleted, so
-- the history is the audit trail.
--
-- Read: any member of the organization (managers follow who has accepted).
-- Insert: only the employee themself, through the account linked to their
-- employee record.

create table if not exists public.employee_position_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  position_name text not null,
  description_version integer not null check (description_version > 0),
  acknowledged_at timestamptz not null default now(),
  acknowledged_by uuid not null default auth.uid() references auth.users(id),
  acknowledged_by_name text
);

create index if not exists employee_position_acknowledgements_employee_idx
  on public.employee_position_acknowledgements (organization_id, employee_id, acknowledged_at desc);

alter table public.employee_position_acknowledgements enable row level security;

create policy employee_position_acknowledgements_read on public.employee_position_acknowledgements
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy employee_position_acknowledgements_insert on public.employee_position_acknowledgements
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and acknowledged_by = (select auth.uid())
    and exists (
      select 1 from public.employees e
      where e.id = employee_id
        and e.organization_id = employee_position_acknowledgements.organization_id
        and e.user_id = (select auth.uid())
    )
  );

grant select, insert on public.employee_position_acknowledgements to authenticated;
