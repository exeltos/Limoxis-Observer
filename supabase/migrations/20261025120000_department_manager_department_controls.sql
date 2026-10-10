-- Department managers create and maintain their own department's controls.
--
-- The application lets a department manager create a control for their
-- department (ControlsPage: createdByScope 'department', the manager's
-- department only), but the database only accepted control definitions and
-- assignments from roles with manage_controls (hospital admin, infection
-- control lead, quality manager). Confirmed on the live database: a department
-- manager's insert into control_definitions failed with an RLS error, so the
-- "New control" action could never be saved.
--
-- A department manager may now insert and update:
--   - control definitions marked createdByScope 'department' (they cannot
--     create or turn one into a central control);
--   - and update them only while every assignment of the control is in a
--     department the manager is scoped to (organization_member_scopes);
--   - control assignments of such a control, only for their own departments.
-- Deleting definitions or assignments stays with manage_controls.
--
-- current_user_manages_department_control is SECURITY DEFINER so that it sees
-- every assignment of the control: under the caller's own RLS a manager would
-- not see other departments' assignments and the "all departments are mine"
-- check would pass wrongly.

create or replace function public.current_user_manages_department_control(target_org uuid, target_control uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_org_role(target_org, array['department_manager']::public.app_role[])
    and exists (
      select 1 from public.control_definitions d
      where d.id = target_control and d.organization_id = target_org
        and d.response_config -> '__meta' ->> 'createdByScope' = 'department'
    )
    and not exists (
      select 1 from public.control_assignments a
      where a.control_id = target_control and a.organization_id = target_org
        and not public.current_user_has_department_scope(target_org, a.department_id)
    );
$$;

revoke execute on function public.current_user_manages_department_control(uuid, uuid) from public, anon;
grant execute on function public.current_user_manages_department_control(uuid, uuid) to authenticated;

-- The existing policies are altered in place (ALTER POLICY keeps their name and
-- roles); only their conditions gain the department-manager alternative.

alter policy control_definitions_insert on public.control_definitions
with check (
  public.current_user_has_capability(organization_id, 'manage_controls')
  or (
    public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
    and response_config -> '__meta' ->> 'createdByScope' = 'department'
  )
);

alter policy control_definitions_update on public.control_definitions
using (
  public.current_user_has_capability(organization_id, 'manage_controls')
  or public.current_user_manages_department_control(organization_id, id)
)
with check (
  public.current_user_has_capability(organization_id, 'manage_controls')
  or (
    public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[])
    and response_config -> '__meta' ->> 'createdByScope' = 'department'
  )
);

alter policy control_assignments_insert on public.control_assignments
with check (
  public.current_user_has_capability(organization_id, 'manage_controls')
  or (
    public.current_user_manages_department_control(organization_id, control_id)
    and public.current_user_has_department_scope(organization_id, department_id)
  )
);

alter policy control_assignments_update on public.control_assignments
using (
  public.current_user_has_capability(organization_id, 'manage_controls')
  or (
    public.current_user_manages_department_control(organization_id, control_id)
    and public.current_user_has_department_scope(organization_id, department_id)
  )
)
with check (
  public.current_user_has_capability(organization_id, 'manage_controls')
  or (
    public.current_user_manages_department_control(organization_id, control_id)
    and public.current_user_has_department_scope(organization_id, department_id)
  )
);
