-- FileMaker (ISOWISE) migration, step 1: a staging area. The filemaker-import
-- function reads every table of the hospital's FileMaker database through its
-- OData API and keeps each record here as it was, untouched. Nothing here is
-- shown in the app: the records are checked, corrected and only then moved into
-- the Limoxis tables. No browser role can read or write these tables (RLS on,
-- no policies, grants revoked); only the service role used by the function and
-- the database owner can.

create table if not exists public.fm_stage_tables (
  base_table text primary key,
  occurrence text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expected integer not null default 0,
  remote_count integer,
  fetched integer not null default 0,
  next_skip integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error', 'skipped')),
  field_names text[],
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
comment on table public.fm_stage_tables is 'FileMaker migration: one row per FileMaker base table to read, with its progress.';

create table if not exists public.fm_stage_records (
  base_table text not null references public.fm_stage_tables(base_table) on delete cascade,
  record_id text not null,
  mod_id text,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (base_table, record_id)
);
comment on table public.fm_stage_records is 'FileMaker migration: each FileMaker record as read, before any correction.';

create table if not exists public.fm_stage_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  page_size integer not null default 500 check (page_size between 10 and 5000),
  running_until timestamptz,
  last_run_at timestamptz,
  last_result jsonb
);
insert into public.fm_stage_settings (id) values (true) on conflict do nothing;
comment on table public.fm_stage_settings is 'FileMaker migration: whether the reading runs, and its last result.';

alter table public.fm_stage_tables enable row level security;
alter table public.fm_stage_records enable row level security;
alter table public.fm_stage_settings enable row level security;
revoke all on public.fm_stage_tables, public.fm_stage_records, public.fm_stage_settings from public, anon, authenticated;

-- Called by pg_cron every minute while the reading is enabled and a table is left.
create or replace function private.filemaker_import_dispatch(p_task text default 'pull')
returns bigint language plpgsql security definer set search_path = ''
as $function$
declare
  v_url text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_functions_url');
  v_secret text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_scheduler_secret');
begin
  if v_url is null or v_secret is null then return null; end if;
  if p_task = 'pull' and not (
    (select enabled from public.fm_stage_settings where id)
    and exists (select 1 from public.fm_stage_tables where status in ('pending', 'running'))) then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/filemaker-import',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-limoxis-scheduler', v_secret),
    body := jsonb_build_object('task', p_task),
    timeout_milliseconds := 150000);
end;
$function$;
revoke all on function private.filemaker_import_dispatch(text) from public, anon, authenticated;

select cron.schedule('limoxis-filemaker-import', '* * * * *', 'select private.filemaker_import_dispatch(''pull'');');
