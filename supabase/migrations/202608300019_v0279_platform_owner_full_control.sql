-- Limoxis Observer v0.27.9 — Platform Owner full-control foundation.
--
-- Product decision: platform_owner is the top-level accountable operator and may
-- enter any organization and use every current operational module directly.
-- This intentionally supersedes the v0.27.3 restriction that excluded
-- platform_owner from clinical/laboratory content. Every access remains tied to
-- the authenticated platform-owner identity and is therefore auditable.

begin;

create or replace function public.current_user_has_governance_capability(target_org uuid, requested_capability text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.current_user_is_platform_owner() or (
  public.current_user_has_capability(target_org,requested_capability)
  or exists (
    select 1 from public.organization_members om
    where om.organization_id=target_org and om.user_id=auth.uid() and om.status='active'
      and case requested_capability
        when 'view_committees' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','quality_manager')
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
  ));
$$;

create or replace function public.current_user_can_access_control_department(target_org uuid,target_department uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_user_is_platform_owner() or (
    public.current_user_has_org_role(target_org,array['hospital_admin','infection_control_lead','infection_control_member','laboratory','quality_manager']::public.app_role[])
    or (target_department is not null and public.current_user_has_department_scope(target_org,target_department))
  );
$$;

drop policy if exists ast_authorized_read on public.antimicrobial_susceptibility_results;
create policy ast_authorized_read on public.antimicrobial_susceptibility_results for select using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[])
);

drop policy if exists amr_authorized_read on public.amr_classifications;
create policy amr_authorized_read on public.amr_classifications for select using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::public.app_role[])
);

drop policy if exists critical_comm_authorized_read on public.critical_result_communications;
create policy critical_comm_authorized_read on public.critical_result_communications for select using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::public.app_role[])
);

drop policy if exists laboratory_samples_read on public.laboratory_samples;
create policy laboratory_samples_read on public.laboratory_samples for select using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','laboratory']::public.app_role[])
  or (public.current_user_has_org_role(organization_id, array['department_manager']::public.app_role[]) and department_id is not null and public.current_user_has_department_scope(organization_id, department_id))
);

drop policy if exists antimicrobial_therapies_read on public.antimicrobial_therapies;
create policy antimicrobial_therapies_read on public.antimicrobial_therapies for select using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','pharmacy','doctor_reviewer']::public.app_role[])
);

drop policy if exists clinical_audit_authorized_read on public.clinical_audit_log;
create policy clinical_audit_authorized_read on public.clinical_audit_log for select using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['infection_control_lead']::public.app_role[])
);

drop policy if exists hai_classification_write on public.hai_classifications;
create policy hai_classification_write on public.hai_classifications for all using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
) with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id,array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
);

create or replace function public.can_view_surveillance_record(target_org uuid, target_department uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_is_platform_owner()
  or public.current_user_has_org_role(target_org, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
  or (
    public.current_user_has_org_role(target_org, array['department_manager']::public.app_role[])
    and target_department is not null
    and public.current_user_has_department_scope(target_org, target_department)
  );
$$;

commit;
