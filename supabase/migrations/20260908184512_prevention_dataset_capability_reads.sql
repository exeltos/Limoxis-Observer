-- Limoxis Observer — Prevention dataset read authorization hardening
-- Module access (view_prevention) controls navigation. Dataset reads for department-scoped users
-- require the matching prevention capability; hospital admin / infection control retain broad read access.

create or replace function public.current_user_can_read_hand_hygiene(target_org uuid, target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and (
        public.current_user_has_capability(target_org,'record_hand_hygiene')
        or public.current_user_has_capability(target_org,'hand_hygiene_observer')
      )
    );
$$;

create or replace function public.current_user_can_read_waste(target_org uuid, target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and (
        public.current_user_has_capability(target_org,'record_waste')
        or public.current_user_has_capability(target_org,'waste_management')
      )
    );
$$;

create or replace function public.current_user_can_read_antiseptic(target_org uuid, target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_antiseptic')
    );
$$;

create or replace function public.current_user_can_read_prevention_bundle(target_org uuid, target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select
    public.current_user_is_platform_owner()
    or public.is_org_admin(target_org)
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_prevention_bundle')
    );
$$;
