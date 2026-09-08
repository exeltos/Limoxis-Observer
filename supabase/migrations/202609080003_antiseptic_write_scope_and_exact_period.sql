-- Limoxis Observer — Antiseptic consumption operational write scope
-- Hospital Admin retains broad read access but does not gain operational write access by admin status alone.

create or replace function public.current_user_can_write_antiseptic(target_org uuid, target_department uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(target_org,array['infection_control_lead','infection_control_member']::public.app_role[])
    or (
      target_department is not null
      and public.current_user_has_department_scope(target_org,target_department)
      and public.current_user_has_capability(target_org,'record_antiseptic')
    );
$$;
