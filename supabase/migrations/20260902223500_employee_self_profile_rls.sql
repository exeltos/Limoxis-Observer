-- IND02 strict role audit: VIEW_MY_PROFILE is a true self scope.
-- An authenticated employee may read only the employee row explicitly linked
-- to their auth account. This does not grant VIEW_STAFF or employee mutation.

create or replace function public.current_user_is_employee_self(target_org uuid,target_user uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    target_user is not null
    and target_user = auth.uid()
    and public.is_org_member(target_org);
$$;

revoke all on function public.current_user_is_employee_self(uuid,uuid) from public;
grant execute on function public.current_user_is_employee_self(uuid,uuid) to authenticated;

drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees
for select to authenticated
using (
  public.current_user_can_view_employee(organization_id,department_id)
  or public.current_user_is_employee_self(organization_id,user_id)
);

-- Deliberately do not broaden employees_write. Self-service profile visibility is
-- read-only unless a separate, field-restricted self-service mutation RPC is added.
