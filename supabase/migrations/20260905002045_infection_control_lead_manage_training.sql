create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.current_user_is_platform_owner()
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
          else false
        end
      )
  );
$$;
