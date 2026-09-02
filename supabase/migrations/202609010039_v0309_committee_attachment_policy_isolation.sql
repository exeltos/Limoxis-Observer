drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments
for select
to public
using (entity_type <> 'committee_document' and is_org_member(organization_id));

drop policy if exists attachments_write on public.attachments;
create policy attachments_write on public.attachments
for insert
to public
with check (entity_type <> 'committee_document' and is_org_member(organization_id) and uploaded_by = auth.uid());

drop policy if exists attachments_soft_delete on public.attachments;
create policy attachments_soft_delete on public.attachments
for update
to public
using (entity_type <> 'committee_document' and ((uploaded_by = auth.uid()) or is_org_admin(organization_id)))
with check (entity_type <> 'committee_document' and ((uploaded_by = auth.uid()) or is_org_admin(organization_id)));

drop policy if exists attachments_bucket_read on storage.objects;
create policy attachments_bucket_read on storage.objects
for select
to public
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2], '') <> 'committee_document'
  and is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists attachments_bucket_upload on storage.objects;
create policy attachments_bucket_upload on storage.objects
for insert
to public
with check (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2], '') <> 'committee_document'
  and is_org_member(((storage.foldername(name))[1])::uuid)
  and owner = auth.uid()
);

drop policy if exists attachments_bucket_delete on storage.objects;
create policy attachments_bucket_delete on storage.objects
for delete
to public
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2], '') <> 'committee_document'
  and ((owner = auth.uid()) or is_org_admin(((storage.foldername(name))[1])::uuid))
);
