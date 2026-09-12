-- Give patient clinical case attachments the same row-visibility pattern already
-- established for laboratory sample attachments: excluded from the generic
-- organization-member attachment policies, scoped instead to the parent
-- surveillance case's organization, with write/delete restricted to the roles
-- already authorized to manage the clinical journey (clinical_assessments_write).

alter policy attachments_read on public.attachments
  using (entity_type not in ('committee_document','laboratory_sample','clinical_case') and is_org_member(organization_id));
alter policy attachments_write on public.attachments
  with check (entity_type not in ('committee_document','laboratory_sample','clinical_case') and is_org_member(organization_id) and uploaded_by = (select auth.uid()));
alter policy attachments_soft_delete on public.attachments
  using (entity_type not in ('committee_document','laboratory_sample','clinical_case') and (uploaded_by = (select auth.uid()) or is_org_admin(organization_id)))
  with check (entity_type not in ('committee_document','laboratory_sample','clinical_case') and (uploaded_by = (select auth.uid()) or is_org_admin(organization_id)));

create policy attachments_clinical_case_read on public.attachments
for select to authenticated
using (
  entity_type = 'clinical_case'
  and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.surveillance_cases sc
    where sc.id = entity_id::uuid and sc.organization_id = attachments.organization_id
  )
);

create policy attachments_clinical_case_write on public.attachments
for insert to authenticated
with check (
  entity_type = 'clinical_case'
  and uploaded_by = (select auth.uid())
  and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (select 1 from public.surveillance_cases sc where sc.id = entity_id::uuid and sc.organization_id = attachments.organization_id)
  and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::app_role[]))
);

create policy attachments_clinical_case_soft_delete on public.attachments
for update to authenticated
using (
  entity_type = 'clinical_case'
  and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::app_role[]))
)
with check (
  entity_type = 'clinical_case'
  and (current_user_is_platform_owner() or current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::app_role[]))
);

alter policy attachments_bucket_read on storage.objects
  using (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample','clinical_case') and is_org_member(((storage.foldername(name))[1])::uuid));
alter policy attachments_bucket_upload on storage.objects
  with check (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample','clinical_case') and is_org_member(((storage.foldername(name))[1])::uuid) and owner = (select auth.uid()));
