-- FileMaker files that already live in attachments are kept once: their copy in
-- the staging bucket (about 1.7 GB) is removed by the edge function
-- filemaker-staging-purge. Only a file whose attachments row AND storage object
-- are there is listed; the fm_stage_files row stays, marked staging_purged_at.

alter table public.fm_stage_files add column if not exists staging_purged_at timestamptz;

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
    -- another row sharing the same staged object keeps it until it is attached too
    and not exists (
      select 1 from public.fm_stage_files t
      where t.storage_path = f.storage_path and t.attachment_id is null and t.staging_purged_at is null
    )
  order by f.base_table, f.field, f.record_id
  limit greatest(1, least(p_limit, 500))
$$;

revoke all on function public.fm_stage_files_purgeable(integer) from public, anon, authenticated;
grant execute on function public.fm_stage_files_purgeable(integer) to service_role;

-- Calls filemaker-staging-purge with the scheduler secret (run by hand, or until
-- fm_stage_files_purgeable is empty).
create or replace function private.filemaker_staging_purge_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_url text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_functions_url');
  v_secret text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_scheduler_secret');
begin
  if v_url is null or v_secret is null then return null; end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/filemaker-staging-purge',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-limoxis-scheduler', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
end;
$function$;

revoke all on function private.filemaker_staging_purge_dispatch() from public;
