-- Limoxis Observer
-- Committee workflow fixes: audit trigger compatibility and committee attachment allow policies.

create or replace function public.set_repository_audit_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  row_data jsonb;
  patch jsonb := '{}'::jsonb;
begin
  row_data := to_jsonb(new);

  if row_data ? 'updated_at' then
    patch := patch || jsonb_build_object('updated_at', now());
  end if;

  if tg_op = 'INSERT'
     and row_data ? 'created_by'
     and nullif(row_data->>'created_by','') is null then
    patch := patch || jsonb_build_object('created_by', auth.uid());
  end if;

  if row_data ? 'updated_by'
     and (tg_op = 'UPDATE' or nullif(row_data->>'updated_by','') is null) then
    patch := patch || jsonb_build_object('updated_by', auth.uid());
  end if;

  if patch <> '{}'::jsonb then
    new := jsonb_populate_record(new, patch);
  end if;

  return new;
end;
$$;

-- Committee attachment guard policies are RESTRICTIVE. Add matching
-- PERMISSIVE policies so committee_document rows can actually be read/written.
drop policy if exists attachments_committee_insert_allow on public.attachments;
create policy attachments_committee_insert_allow
on public.attachments
as permissive
for insert
to authenticated
with check (
  entity_type = 'committee_document'
  and uploaded_by = auth.uid()
  and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.current_user_can_manage_committee(
    organization_id,
    entity_id::uuid,
    'manage_committee_documents'
  )
);

drop policy if exists attachments_committee_read_allow on public.attachments;
create policy attachments_committee_read_allow
on public.attachments
as permissive
for select
to authenticated
using (
  entity_type = 'committee_document'
  and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.current_user_can_view_committee(organization_id, entity_id::uuid)
);

drop policy if exists attachments_committee_update_allow on public.attachments;
create policy attachments_committee_update_allow
on public.attachments
as permissive
for update
to authenticated
using (
  entity_type = 'committee_document'
  and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.current_user_can_manage_committee(
    organization_id,
    entity_id::uuid,
    'manage_committee_documents'
  )
)
with check (
  entity_type = 'committee_document'
  and entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.current_user_can_manage_committee(
    organization_id,
    entity_id::uuid,
    'manage_committee_documents'
  )
);

-- Storage object policies need the same permissive counterpart because the
-- existing committee guards are restrictive and the generic attachment
-- policies intentionally exclude committee_document paths.
drop policy if exists attachments_storage_committee_insert_allow on storage.objects;
create policy attachments_storage_committee_insert_allow
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and owner = auth.uid()
  and coalesce((storage.foldername(name))[2],'') = 'committee_document'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.current_user_can_manage_committee(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[3])::uuid,
    'manage_committee_documents'
  )
);

drop policy if exists attachments_storage_committee_read_allow on storage.objects;
create policy attachments_storage_committee_read_allow
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2],'') = 'committee_document'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.current_user_can_view_committee(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[3])::uuid
  )
);

drop policy if exists attachments_storage_committee_delete_allow on storage.objects;
create policy attachments_storage_committee_delete_allow
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and coalesce((storage.foldername(name))[2],'') = 'committee_document'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.current_user_can_manage_committee(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[3])::uuid,
    'manage_committee_documents'
  )
);
