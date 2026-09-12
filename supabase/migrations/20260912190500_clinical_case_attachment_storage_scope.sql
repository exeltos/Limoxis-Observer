alter policy attachments_bucket_delete on storage.objects
  using (bucket_id = 'attachments' and coalesce((storage.foldername(name))[2],'') not in ('committee_document','laboratory_sample','clinical_case') and (owner = (select auth.uid()) or is_org_admin(((storage.foldername(name))[1])::uuid)));

create policy attachments_storage_clinical_case_read on storage.objects
for select to authenticated
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2],'') = 'clinical_case'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.surveillance_cases sc
    where sc.id = ((storage.foldername(objects.name))[3])::uuid and sc.organization_id = ((storage.foldername(objects.name))[1])::uuid
  )
);

create policy attachments_storage_clinical_case_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and owner = (select auth.uid())
  and coalesce((storage.foldername(name))[2],'') = 'clinical_case'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.surveillance_cases sc
    where sc.id = ((storage.foldername(objects.name))[3])::uuid and sc.organization_id = ((storage.foldername(objects.name))[1])::uuid
  )
  and (current_user_is_platform_owner() or current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::app_role[]))
);

create policy attachments_storage_clinical_case_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2],'') = 'clinical_case'
  and (current_user_is_platform_owner() or current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::app_role[]))
);
