create or replace function public.current_user_has_governance_capability(target_org uuid, requested_capability text)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select public.current_user_is_platform_owner() or (
    public.current_user_has_capability(target_org,requested_capability)
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id=target_org
        and om.user_id=auth.uid()
        and om.status='active'
        and case requested_capability
          when 'view_committees' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'manage_committees' then om.role in ('hospital_admin','infection_control_lead')
          when 'create_committee' then om.role in ('hospital_admin','infection_control_lead')
          when 'manage_committee_members' then om.role in ('hospital_admin','infection_control_lead')
          when 'create_committee_meeting' then om.role in ('hospital_admin','infection_control_lead')
          when 'edit_committee_minutes' then om.role in ('hospital_admin','infection_control_lead')
          when 'finalize_committee_minutes' then om.role in ('hospital_admin','infection_control_lead')
          when 'manage_committee_decisions' then om.role in ('hospital_admin','infection_control_lead')
          when 'manage_committee_documents' then om.role in ('hospital_admin','infection_control_lead')
          when 'archive_committee' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_documents' then true
          when 'manage_documents' then om.role in ('hospital_admin','quality_manager')
          when 'submit_document_review' then om.role in ('hospital_admin','quality_manager')
          when 'approve_document' then om.role in ('hospital_admin','quality_manager')
          when 'publish_document' then om.role in ('hospital_admin','quality_manager')
          when 'supersede_document' then om.role in ('hospital_admin','quality_manager')
          when 'archive_document' then om.role in ('hospital_admin','quality_manager')
          when 'delete_document_draft' then om.role in ('hospital_admin','quality_manager')
          when 'execute_control' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
          when 'edit_control_definition' then om.role in ('hospital_admin','infection_control_lead','department_manager','quality_manager')
          when 'edit_control_execution' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','department_user','laboratory','quality_manager')
          when 'void_control_execution' then om.role in ('hospital_admin','infection_control_lead','department_manager','quality_manager')
          when 'archive_control_definition' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'delete_control_draft' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          else false
        end
    )
  );
$function$;

create or replace function public.current_user_can_view_committee(target_org uuid, target_committee uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select
    public.current_user_has_governance_capability(target_org,'view_committees')
    or public.current_user_can_manage_committee(target_org,target_committee,'edit_committee_minutes')
    or exists (
      select 1
      from public.committee_members cm
      where cm.organization_id=target_org
        and cm.committee_id=target_committee
        and cm.user_id=auth.uid()
        and cm.ended_at is null
        and cm.approval_status in ('approved','not_required')
    );
$function$;

revoke all on function public.current_user_has_governance_capability(uuid,text) from public, anon;
revoke all on function public.current_user_can_view_committee(uuid,uuid) from public, anon;
revoke all on function public.current_user_can_manage_committee(uuid,uuid,text) from public, anon;
grant execute on function public.current_user_has_governance_capability(uuid,text) to authenticated, service_role;
grant execute on function public.current_user_can_view_committee(uuid,uuid) to authenticated, service_role;
grant execute on function public.current_user_can_manage_committee(uuid,uuid,text) to authenticated, service_role;
