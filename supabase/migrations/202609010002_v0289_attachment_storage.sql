-- Limoxis Observer v0.28.9
-- Real file storage for the shared AttachmentField component (used across 8
-- features: Committees, Documents x2, Employees, Laboratory, Quality x2,
-- Surveillance/Patients). Previously every "attach a file" flow base64-encoded
-- the whole file into the record's JSON and saved it to localStorage only —
-- never durable, never synced across devices, and capped by the browser's
-- localStorage quota. public.attachments already existed (added in v0.7.0)
-- but had no real Storage bucket or upload path wired to it, and no way to
-- soft-delete a row (AttachmentField's existing "remove" action had no
-- matching database permission to actually succeed).
--
-- Path convention: {organization_id}/{entity_type}/{entity_id}/{filename} —
-- the storage.objects RLS policies read path_tokens[1] as the organization
-- id, mirroring the same is_org_member()/uploaded-by-self checks already
-- used by public.attachments' own row-level policies.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400) -- 25MB per file
on conflict (id) do nothing;

drop policy if exists "attachments_bucket_read" on storage.objects;
create policy "attachments_bucket_read" on storage.objects for select using (
  bucket_id = 'attachments'
  and public.is_org_member((path_tokens[1])::uuid)
);

drop policy if exists "attachments_bucket_upload" on storage.objects;
create policy "attachments_bucket_upload" on storage.objects for insert with check (
  bucket_id = 'attachments'
  and public.is_org_member((path_tokens[1])::uuid)
  and owner = auth.uid()
);

drop policy if exists "attachments_bucket_delete" on storage.objects;
create policy "attachments_bucket_delete" on storage.objects for delete using (
  bucket_id = 'attachments'
  and (owner = auth.uid() or public.is_org_admin((path_tokens[1])::uuid))
);

drop policy if exists attachments_soft_delete on public.attachments;
create policy attachments_soft_delete on public.attachments for update using (
  uploaded_by = auth.uid() or public.is_org_admin(organization_id)
) with check (
  uploaded_by = auth.uid() or public.is_org_admin(organization_id)
);

-- AttachmentField's UI already collects a category and free-text description
-- per file — public.attachments had no column to hold either.
alter table public.attachments add column if not exists metadata jsonb not null default '{}'::jsonb;
