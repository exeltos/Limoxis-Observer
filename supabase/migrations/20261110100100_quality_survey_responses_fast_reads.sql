-- Survey responses: reading checks access once per query instead of once per
-- row. The organizations where the user reads all of Quality, and the
-- departments the user is scoped to, are worked out once (scalar subqueries)
-- and each row is compared with them. Same rows as before for every role; with
-- the 8,271 responses of a hospital a page of 1,000 went from 1–2.7 s to a few ms.

create or replace function private.current_user_quality_read_orgs()
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct om.organization_id), '{}') from public.organization_members om
  where om.user_id = auth.uid() and om.status = 'active'
    and (om.role = any (array['hospital_admin','quality_manager','infection_control_lead']::public.app_role[])
      or public.current_user_has_capability(om.organization_id, 'view_quality'));
$$;
revoke all on function private.current_user_quality_read_orgs() from public, anon;
grant execute on function private.current_user_quality_read_orgs() to authenticated;

-- "organization:department" for every department the user is scoped to.
create or replace function private.current_user_department_scopes()
returns text[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(om.organization_id::text || ':' || oms.department_id::text), '{}')
  from public.organization_members om join public.organization_member_scopes oms on oms.membership_id = om.id
  where om.user_id = auth.uid() and om.status = 'active';
$$;
revoke all on function private.current_user_department_scopes() from public, anon;
grant execute on function private.current_user_department_scopes() to authenticated;

alter policy quality_survey_responses_read on public.quality_survey_responses using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[])
  or (department_id is not null and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_department_scopes())::text[])));
