-- Read-acknowledgement log for controlled documents.
--
-- A distribution (management_announcements with link_path '/documents/...') is
-- acknowledged per user in management_announcement_acknowledgements. Document
-- managers can already read every acknowledgement, but not who else was in the
-- audience: organization_members is visible to hospital admins only and
-- organization_member_scopes to each member for their own row. Without the
-- audience there is no "pending" list and no percentage for an inspection.
--
-- This function returns the active members of an organization with what the
-- audience rules match on (role, department scopes) plus the employee record's
-- professional category and department for display. It answers only the roles
-- that manage distributions (the same set allowed to create them and to read
-- all acknowledgements); for anyone else it returns nothing.

create or replace function public.document_acknowledgement_members(p_organization_id uuid)
returns table (
  user_id uuid,
  full_name text,
  member_role text,
  department_ids uuid[],
  profession text,
  profession_en text,
  employee_department text,
  employee_department_en text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    om.user_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), '') as full_name,
    om.role::text as member_role,
    coalesce((select array_agg(oms.department_id) from public.organization_member_scopes oms where oms.membership_id = om.id and oms.department_id is not null), '{}'::uuid[]) as department_ids,
    e.profession_name as profession,
    e.profession_name_en as profession_en,
    e.department_name as employee_department,
    e.department_name_en as employee_department_en
  from public.organization_members om
  left join public.profiles p on p.id = om.user_id
  left join lateral (
    select emp.profession_name, emp.profession_name_en, emp.department_name, emp.department_name_en
    from public.employees emp
    where emp.organization_id = om.organization_id and emp.user_id = om.user_id
    order by emp.updated_at desc nulls last
    limit 1
  ) e on true
  where om.organization_id = p_organization_id
    and om.status = 'active'
    and (
      public.is_org_admin(p_organization_id)
      or public.current_user_has_org_role(p_organization_id, array['infection_control_lead'::public.app_role, 'quality_manager'::public.app_role])
    );
$$;

revoke all on function public.document_acknowledgement_members(uuid) from public, anon;
grant execute on function public.document_acknowledgement_members(uuid) to authenticated;
