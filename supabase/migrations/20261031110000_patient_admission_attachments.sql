-- Documents of an admission (a patient record tab), also when the admission has
-- no surveillance yet. Same visibility as the surveillance documents
-- (clinical_case): scoped to an admission of the attachment's organization,
-- written and removed only by the roles that manage the clinical journey, and
-- kept out of the generic organization-member attachment policies.

alter policy attachments_insert on public.attachments
  with check (
    (entity_type = 'clinical_case' and uploaded_by = (select auth.uid()) and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from surveillance_cases sc where sc.id = (attachments.entity_id)::uuid and sc.organization_id = attachments.organization_id) and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'patient_admission' and uploaded_by = (select auth.uid()) and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from patient_admissions pa where pa.id = (attachments.entity_id)::uuid and pa.organization_id = attachments.organization_id) and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'committee_document' and uploaded_by = (select auth.uid()) and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and current_user_can_manage_committee(organization_id, (entity_id)::uuid, 'manage_committee_documents'))
    or (entity_type = 'laboratory_sample' and uploaded_by = (select auth.uid()) and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from laboratory_samples s where s.id = (attachments.entity_id)::uuid and s.organization_id = attachments.organization_id) and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])))
    or (entity_type <> ALL (ARRAY['committee_document'::text, 'laboratory_sample'::text, 'clinical_case'::text, 'patient_admission'::text]) and is_org_member(organization_id) and uploaded_by = (select auth.uid()))
  );

alter policy attachments_read on public.attachments
  using (
    (entity_type = 'clinical_case' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from surveillance_cases sc where sc.id = (attachments.entity_id)::uuid and sc.organization_id = attachments.organization_id))
    or (entity_type = 'patient_admission' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from patient_admissions pa where pa.id = (attachments.entity_id)::uuid and pa.organization_id = attachments.organization_id))
    or (entity_type = 'committee_document' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and current_user_can_view_committee(organization_id, (entity_id)::uuid))
    or (entity_type = 'laboratory_sample' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists (select 1 from laboratory_samples s where s.id = (attachments.entity_id)::uuid and s.organization_id = attachments.organization_id))
    or (entity_type <> ALL (ARRAY['committee_document'::text, 'laboratory_sample'::text, 'clinical_case'::text, 'patient_admission'::text]) and is_org_member(organization_id))
  );

alter policy attachments_update on public.attachments
  using (
    (entity_type = 'clinical_case' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'patient_admission' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'committee_document' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and current_user_can_manage_committee(organization_id, (entity_id)::uuid, 'manage_committee_documents'))
    or (entity_type = 'laboratory_sample' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])))
    or (entity_type <> ALL (ARRAY['committee_document'::text, 'laboratory_sample'::text, 'clinical_case'::text, 'patient_admission'::text]) and (uploaded_by = (select auth.uid()) or is_org_admin(organization_id)))
  )
  with check (
    (entity_type = 'clinical_case' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'patient_admission' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'infection_control_lead'::app_role, 'infection_control_member'::app_role, 'doctor_reviewer'::app_role])))
    or (entity_type = 'committee_document' and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and current_user_can_manage_committee(organization_id, (entity_id)::uuid, 'manage_committee_documents'))
    or (entity_type = 'laboratory_sample' and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, ARRAY['hospital_admin'::app_role, 'laboratory'::app_role])))
    or (entity_type <> ALL (ARRAY['committee_document'::text, 'laboratory_sample'::text, 'clinical_case'::text, 'patient_admission'::text]) and (uploaded_by = (select auth.uid()) or is_org_admin(organization_id)))
  );

alter policy attachments_bucket_read on storage.objects
  using (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample','clinical_case','patient_admission') and is_org_member(((storage.foldername(name))[1])::uuid));
alter policy attachments_bucket_upload on storage.objects
  with check (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample','clinical_case','patient_admission') and is_org_member(((storage.foldername(name))[1])::uuid) and owner = (select auth.uid()));
alter policy attachments_bucket_delete on storage.objects
  using (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample','clinical_case','patient_admission') and (owner = (select auth.uid()) or is_org_admin(((storage.foldername(name))[1])::uuid)));

create policy attachments_storage_patient_admission_read on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2],'') = 'patient_admission'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.patient_admissions pa
    where pa.id = ((storage.foldername(objects.name))[3])::uuid and pa.organization_id = ((storage.foldername(objects.name))[1])::uuid
  )
);

create policy attachments_storage_patient_admission_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and owner = (select auth.uid())
  and coalesce((storage.foldername(name))[2],'') = 'patient_admission'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.patient_admissions pa
    where pa.id = ((storage.foldername(objects.name))[3])::uuid and pa.organization_id = ((storage.foldername(objects.name))[1])::uuid
  )
  and (current_user_is_platform_owner() or current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::app_role[]))
);

create policy attachments_storage_patient_admission_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2],'') = 'patient_admission'
  and (current_user_is_platform_owner() or current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::app_role[]))
);
