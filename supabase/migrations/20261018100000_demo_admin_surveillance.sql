-- Demo permissions (approved by the platform owner): a Demo's Hospital Admin
-- sees Surveillance as a whole, so the evaluator who enters as admin finds
-- the cases, devices, isolation, reassessments, outcomes and antimicrobial
-- therapy of the Demo. Every person in a Demo is synthetic.
--   1. can_view_surveillance_record: written down as it already runs in
--      production (the Hospital Admin is among the roles); nothing changes.
--   2. Antimicrobial therapy and its administrations: an extra read-only
--      policy for the Hospital Admin of a Demo organization only.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

create or replace function public.can_view_surveillance_record(target_org uuid, target_department uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select public.current_user_is_platform_owner()
  or public.current_user_has_org_role(target_org, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
  or (
    public.current_user_has_org_role(target_org, array['department_manager']::public.app_role[])
    and target_department is not null
    and public.current_user_has_department_scope(target_org, target_department)
  );
$function$;

create or replace function public.current_user_is_demo_admin(target_org uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select exists (select 1 from public.organizations o where o.id = target_org and o.is_demo)
    and public.current_user_has_org_role(target_org, array['hospital_admin']::public.app_role[]);
$function$;
revoke all on function public.current_user_is_demo_admin(uuid) from public, anon;
grant execute on function public.current_user_is_demo_admin(uuid) to authenticated;

create policy antimicrobial_therapies_demo_admin_read on public.antimicrobial_therapies for select to authenticated
  using ((select public.current_user_is_demo_admin(organization_id)));
create policy antimicrobial_therapy_administrations_demo_admin_read on public.antimicrobial_therapy_administrations for select to authenticated
  using ((select public.current_user_is_demo_admin(organization_id)));
