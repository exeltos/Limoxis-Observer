-- IND02 strict role audit: antimicrobial therapy follows the explicit
-- manage_antimicrobial_therapy capability. Pharmacy operates hospital-wide;
-- IPC Lead operates hospital-wide; Doctor Reviewer is limited to assigned cases.

create or replace function public.current_user_can_manage_antimicrobial_therapy(target_org uuid,target_case uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    public.current_user_is_platform_owner()
    or (
      public.current_user_has_capability(target_org,'manage_antimicrobial_therapy')
      and (
        public.current_user_has_org_role(target_org,array['infection_control_lead','pharmacy']::public.app_role[])
        or (target_case is not null and public.current_user_has_case_assignment(target_org,target_case))
      )
    );
$$;

revoke all on function public.current_user_can_manage_antimicrobial_therapy(uuid,uuid) from public;
grant execute on function public.current_user_can_manage_antimicrobial_therapy(uuid,uuid) to authenticated;

drop policy if exists antimicrobial_therapies_read on public.antimicrobial_therapies;
create policy antimicrobial_therapies_read on public.antimicrobial_therapies
for select to authenticated
using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','pharmacy']::public.app_role[])
  or (
    surveillance_case_id is not null
    and public.current_user_has_case_assignment(organization_id,surveillance_case_id)
  )
);

drop policy if exists antimicrobial_therapies_write on public.antimicrobial_therapies;
create policy antimicrobial_therapies_write on public.antimicrobial_therapies
for all to authenticated
using (public.current_user_can_manage_antimicrobial_therapy(organization_id,surveillance_case_id))
with check (public.current_user_can_manage_antimicrobial_therapy(organization_id,surveillance_case_id));
