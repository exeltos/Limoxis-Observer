-- Hospital Admin was unintentionally granted access to occupational-health
-- clinical data (medical visits + vaccinations) through the blanket "every
-- capability except platform-only ones" grant in current_user_has_capability().
--
-- The RLS policies on occupational_health_visits and employee_vaccinations
-- were written with an explicit stated intent — see 20260901153852:
--   "Vaccinations: occupational-health clinical data. No HR/Admin implicit
--    read. Only Platform Owner and explicit OH authority."
--   "Occupational physician visits: highest privacy tier in employee domain."
-- That intent was defeated because hospital_admin's blanket capability grant
-- already includes manage_occupational_health/view_occupational_health, so
-- "explicit OH authority" ended up meaning "any Hospital Admin" in practice.
--
-- Per the product's privacy model, Hospital Admin should have no automatic
-- access to this domain (medical visits: "No by default"; vaccinations:
-- governance only, not full clinical manage). Excluding these two
-- capabilities from the built-in hospital_admin blanket grant restores that:
-- only Platform Owner, the occupational_physician role, or a custom role/
-- membership explicitly granted the capability can read or write this data.

create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_is_platform_owner()
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'active'
      and om.role = 'hospital_admin'
      and capability_key not in ('view_platform','manage_platform','view_occupational_health','manage_occupational_health')
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id=auth.uid()
      and om.organization_id=target_org
      and om.status='active'
      and (
        exists (
          select 1
          from public.custom_role_capabilities crc
          where crc.custom_role_id=om.custom_role_id
            and crc.capability=capability_key
        )
        or exists (
          select 1
          from public.organization_member_capabilities omc
          where omc.membership_id=om.id
            and (
              (omc.capability='lab_access' and capability_key='view_lab')
              or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
            )
        )
        or case capability_key
          when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','hr_office')
          when 'manage_training' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
          when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
          when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'view_indicators' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','pharmacy','doctor_reviewer','quality_manager')
          when 'manage_indicators' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          else false
        end
      )
  );
$$;

revoke all on function public.current_user_has_capability(uuid,text) from public;
grant execute on function public.current_user_has_capability(uuid,text) to authenticated;
