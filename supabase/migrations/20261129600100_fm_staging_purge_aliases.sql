-- A staged object shared by two FileMaker fields is attached once (the alias row,
-- duplicate_of set, never is): the alias no longer keeps the object from being
-- purged once the canonical row is attached.
create or replace function public.fm_stage_files_purgeable(p_limit integer default 100)
returns table (base_table text, field text, record_id text, storage_path text)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.base_table, f.field, f.record_id, f.storage_path
  from public.fm_stage_files f
  join public.attachments a on a.id = f.attachment_id
  join storage.objects o on o.bucket_id = 'attachments' and o.name = a.storage_path
  where f.staging_purged_at is null
    and f.duplicate_of is null
    and not exists (
      select 1 from public.fm_stage_files t
      where t.storage_path = f.storage_path and t.attachment_id is null and t.staging_purged_at is null
        and t.duplicate_of is null
    )
  order by f.base_table, f.field, f.record_id
  limit greatest(1, least(p_limit, 500))
$$;
