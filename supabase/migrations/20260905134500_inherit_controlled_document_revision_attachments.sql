create or replace function private.inherit_controlled_document_attachments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.revision_of_id is null then
    return new;
  end if;

  insert into public.attachments(
    organization_id,
    entity_type,
    entity_id,
    file_name,
    storage_path,
    mime_type,
    size_bytes,
    uploaded_by,
    metadata
  )
  select
    new.organization_id,
    'controlled_document',
    new.id::text,
    a.file_name,
    a.storage_path,
    a.mime_type,
    a.size_bytes,
    a.uploaded_by,
    coalesce(a.metadata,'{}'::jsonb) || jsonb_build_object(
      'inherited_from_attachment_id', a.id,
      'inherited_from_document_id', new.revision_of_id
    )
  from public.attachments a
  where a.organization_id = new.organization_id
    and a.entity_type = 'controlled_document'
    and a.entity_id = new.revision_of_id::text
    and a.deleted_at is null
    and not exists (
      select 1
      from public.attachments existing
      where existing.organization_id = new.organization_id
        and existing.entity_type = 'controlled_document'
        and existing.entity_id = new.id::text
        and existing.storage_path = a.storage_path
        and existing.deleted_at is null
    );

  return new;
end;
$function$;

drop trigger if exists trg_inherit_controlled_document_attachments on public.controlled_documents;
create trigger trg_inherit_controlled_document_attachments
after insert on public.controlled_documents
for each row
when (new.revision_of_id is not null)
execute function private.inherit_controlled_document_attachments();

insert into public.attachments(
  organization_id,
  entity_type,
  entity_id,
  file_name,
  storage_path,
  mime_type,
  size_bytes,
  uploaded_by,
  metadata
)
select
  d.organization_id,
  'controlled_document',
  d.id::text,
  a.file_name,
  a.storage_path,
  a.mime_type,
  a.size_bytes,
  a.uploaded_by,
  coalesce(a.metadata,'{}'::jsonb) || jsonb_build_object(
    'inherited_from_attachment_id', a.id,
    'inherited_from_document_id', d.revision_of_id
  )
from public.controlled_documents d
join public.attachments a
  on a.organization_id = d.organization_id
 and a.entity_type = 'controlled_document'
 and a.entity_id = d.revision_of_id::text
 and a.deleted_at is null
where d.revision_of_id is not null
  and not exists (
    select 1
    from public.attachments existing
    where existing.organization_id = d.organization_id
      and existing.entity_type = 'controlled_document'
      and existing.entity_id = d.id::text
      and existing.storage_path = a.storage_path
      and existing.deleted_at is null
  );