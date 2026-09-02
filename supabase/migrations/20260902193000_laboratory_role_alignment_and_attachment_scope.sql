-- Align Laboratory RLS with the application capability model.
-- Platform Owner and Hospital Admin can operate the hospital Laboratory workflow.
-- Doctor Reviewer can read Laboratory samples because VIEW_LAB is part of the role matrix.

alter policy laboratory_samples_read on public.laboratory_samples
  using (
    current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::app_role[])
    or (
      current_user_has_org_role(organization_id, array['department_manager','link_nurse','department_user']::app_role[])
      and department_id is not null
      and current_user_has_department_scope(organization_id, department_id)
    )
  );

alter policy laboratory_samples_insert on public.laboratory_samples
  with check (
    current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[])
    or (
      status = 'requested'
      and requested_by = (select auth.uid())
      and created_by = (select auth.uid())
      and current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::app_role[])
    )
  );

alter policy laboratory_samples_update on public.laboratory_samples
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]));

alter policy laboratory_samples_delete on public.laboratory_samples
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]));

alter policy microbiology_results_insert on public.microbiology_results
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]));
alter policy microbiology_results_update on public.microbiology_results
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]));
alter policy microbiology_results_delete on public.microbiology_results
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]));

alter policy ast_authorized_read on public.antimicrobial_susceptibility_results
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::app_role[]));
alter policy ast_insert on public.antimicrobial_susceptibility_results
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]));
alter policy ast_update on public.antimicrobial_susceptibility_results
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]));
alter policy ast_delete on public.antimicrobial_susceptibility_results
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]));

alter policy critical_comm_authorized_read on public.critical_result_communications
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::app_role[]));
alter policy critical_comm_lab_write on public.critical_result_communications
  with check ((current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[])) and communicated_by = (select auth.uid()));

alter policy amr_authorized_read on public.amr_classifications
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','pharmacy','doctor_reviewer']::app_role[]));
alter policy amr_insert on public.amr_classifications
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory','infection_control_lead','infection_control_member']::app_role[]));
alter policy amr_update on public.amr_classifications
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory','infection_control_lead','infection_control_member']::app_role[]))
  with check (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory','infection_control_lead','infection_control_member']::app_role[]));
alter policy amr_delete on public.amr_classifications
  using (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory','infection_control_lead','infection_control_member']::app_role[]));

-- Laboratory attachments contain clinical data. Remove them from generic organization-member
-- attachment policies and give them the same row visibility as their parent Laboratory sample.
alter policy attachments_read on public.attachments
  using (entity_type not in ('committee_document','laboratory_sample') and is_org_member(organization_id));
alter policy attachments_write on public.attachments
  with check (entity_type not in ('committee_document','laboratory_sample') and is_org_member(organization_id) and uploaded_by = (select auth.uid()));
alter policy attachments_soft_delete on public.attachments
  using (entity_type not in ('committee_document','laboratory_sample') and (uploaded_by = (select auth.uid()) or is_org_admin(organization_id)))
  with check (entity_type not in ('committee_document','laboratory_sample') and (uploaded_by = (select auth.uid()) or is_org_admin(organization_id)));

create policy attachments_laboratory_read on public.attachments
for select to authenticated
using (
  entity_type = 'laboratory_sample'
  and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.laboratory_samples s
    where s.id = entity_id::uuid and s.organization_id = attachments.organization_id
  )
);

create policy attachments_laboratory_write on public.attachments
for insert to authenticated
with check (
  entity_type = 'laboratory_sample'
  and uploaded_by = (select auth.uid())
  and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (select 1 from public.laboratory_samples s where s.id = entity_id::uuid and s.organization_id = attachments.organization_id)
  and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]))
);

create policy attachments_laboratory_soft_delete on public.attachments
for update to authenticated
using (
  entity_type = 'laboratory_sample'
  and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]))
)
with check (
  entity_type = 'laboratory_sample'
  and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','laboratory']::app_role[]))
);

alter policy attachments_bucket_read on storage.objects
  using (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample') and is_org_member(((storage.foldername(name))[1])::uuid));
alter policy attachments_bucket_upload on storage.objects
  with check (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample') and is_org_member(((storage.foldername(name))[1])::uuid) and owner = (select auth.uid()));
alter policy attachments_bucket_delete on storage.objects
  using (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample') and (owner = (select auth.uid()) or is_org_admin(((storage.foldername(name))[1])::uuid)));

create policy attachments_storage_laboratory_read on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2],'') = 'laboratory_sample'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.laboratory_samples s
    where s.id = ((storage.foldername(name))[3])::uuid
      and s.organization_id = ((storage.foldername(name))[1])::uuid
  )
);

create policy attachments_storage_laboratory_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and owner = (select auth.uid())
  and coalesce((storage.foldername(name))[2],'') = 'laboratory_sample'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.laboratory_samples s
    where s.id = ((storage.foldername(name))[3])::uuid
      and s.organization_id = ((storage.foldername(name))[1])::uuid
  )
  and (current_user_is_platform_owner() or current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hospital_admin','laboratory']::app_role[]))
);

create policy attachments_storage_laboratory_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2],'') = 'laboratory_sample'
  and (current_user_is_platform_owner() or current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hospital_admin','laboratory']::app_role[]))
);
