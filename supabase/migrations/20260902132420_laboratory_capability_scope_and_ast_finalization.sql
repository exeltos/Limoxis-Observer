-- Make VIEW_LAB capability and department scope agree between UI and RLS.
create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select public.current_user_is_platform_owner()
  or exists (
    select 1
    from public.organization_members om
    where om.user_id=auth.uid()
      and om.organization_id=target_org
      and om.status='active'
      and (
        exists (
          select 1 from public.custom_role_capabilities crc
          where crc.custom_role_id=om.custom_role_id and crc.capability=capability_key
        )
        or exists (
          select 1 from public.organization_member_capabilities omc
          where omc.membership_id=om.id and (
            (omc.capability='lab_access' and capability_key='view_lab')
            or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
          )
        )
        or case capability_key
          when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','hr_office')
          when 'manage_training' then om.role in ('hospital_admin')
          when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
          when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
          when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          else false
        end
      )
  );
$function$;

alter policy laboratory_samples_read on public.laboratory_samples
using (
  current_user_is_platform_owner()
  or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::app_role[])
  or (
    current_user_has_capability(organization_id,'view_lab')
    and department_id is not null
    and current_user_has_department_scope(organization_id, department_id)
  )
);

create or replace function public.guard_finalized_ast_mutation()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  target_result uuid;
  target_status text;
begin
  target_result := coalesce(new.microbiology_result_id, old.microbiology_result_id);
  select validation_status into target_status from public.microbiology_results where id=target_result;
  if target_status is distinct from 'draft' then
    raise exception 'AST evidence for a finalized microbiology result is immutable; create an amended result version instead.' using errcode='55000';
  end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists guard_finalized_ast_mutation on public.antimicrobial_susceptibility_results;
create trigger guard_finalized_ast_mutation
before insert or update or delete on public.antimicrobial_susceptibility_results
for each row execute function public.guard_finalized_ast_mutation();

revoke all on function public.guard_finalized_ast_mutation() from public, anon, authenticated;
