-- Employees module review: the redesigned performance-evaluation workflow
-- (submit -> employee acknowledgement (agree/disagree) -> HR approval ->
-- final approval) reads/writes columns that were never added to
-- employee_evaluations — the table still only has the original v0.9.0
-- shape (title/result/notes). Every evaluation create and every workflow
-- action would fail in production with "column does not exist".

alter table public.employee_evaluations
  add column if not exists evaluation_period text,
  add column if not exists status text not null default 'draft',
  add column if not exists evaluator_user_id uuid references auth.users(id),
  add column if not exists criteria jsonb not null default '[]'::jsonb,
  add column if not exists overall_score numeric,
  add column if not exists employee_comment text,
  add column if not exists employee_agreement text,
  add column if not exists employee_acknowledged_at timestamptz,
  add column if not exists employee_acknowledged_by uuid references auth.users(id),
  add column if not exists hr_approved_at timestamptz,
  add column if not exists hr_approved_by uuid references auth.users(id),
  add column if not exists admin_approved_at timestamptz,
  add column if not exists admin_approved_by uuid references auth.users(id),
  add column if not exists finalized_at timestamptz;

alter table public.employee_evaluations
  drop constraint if exists employee_evaluations_status_check;
alter table public.employee_evaluations
  add constraint employee_evaluations_status_check
  check (status in ('draft','submitted','employee_acknowledged','hr_approved','finalized'));

alter table public.employee_evaluations
  drop constraint if exists employee_evaluations_employee_agreement_check;
alter table public.employee_evaluations
  add constraint employee_evaluations_employee_agreement_check
  check (employee_agreement is null or employee_agreement in ('agree','disagree'));

-- The frontend already offers department_manager evaluation creation
-- (EmployeeRecordPage.jsx: canCreate includes role==='department_manager')
-- and lets the evaluated employee acknowledge their own submitted
-- evaluation, but RLS only ever allowed hr_office/admin/manage_staff_admin
-- to insert or update — both flows were silently rejected by Postgres in
-- production. Widen insert to scoped department managers (matching the
-- existing select policy's department_manager clause) and widen update to
-- let the evaluated employee move their own evaluation from 'submitted' to
-- 'employee_acknowledged' only.

drop policy if exists employee_evaluations_insert_authorized on public.employee_evaluations;
create policy employee_evaluations_insert_authorized
on public.employee_evaluations
for insert
to authenticated
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
  or exists (
    select 1
    from public.employees e
    where e.id = employee_evaluations.employee_id
      and e.organization_id = employee_evaluations.organization_id
      and e.department_id is not null
      and public.current_user_has_org_role(employee_evaluations.organization_id, array['department_manager'::public.app_role])
      and public.current_user_has_department_scope(employee_evaluations.organization_id, e.department_id)
  )
);

drop policy if exists employee_evaluations_update_authorized on public.employee_evaluations;
create policy employee_evaluations_update_authorized
on public.employee_evaluations
for update
to authenticated
using (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
  or (
    status = 'submitted'
    and exists (
      select 1 from public.employees e
      where e.id = employee_evaluations.employee_id
        and e.organization_id = employee_evaluations.organization_id
        and e.user_id = auth.uid()
    )
  )
)
with check (
  public.current_user_is_platform_owner()
  or public.is_org_admin(organization_id)
  or public.current_user_has_org_role(organization_id, array['hr_office'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_staff_admin')
  or (
    status = 'employee_acknowledged'
    and exists (
      select 1 from public.employees e
      where e.id = employee_evaluations.employee_id
        and e.organization_id = employee_evaluations.organization_id
        and e.user_id = auth.uid()
    )
  )
);
