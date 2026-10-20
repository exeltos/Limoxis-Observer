-- «Βιβλιοθήκη» (Library): trusted sources for infection prevention, quality and
-- nursing, for every member of every hospital.
--
-- library_items    links, guidelines and one-page clinical guides. organization_id
--                  null = platform content (the Platform Owner keeps it, every
--                  hospital reads it); otherwise a hospital's own addition (its
--                  Hospital Admin or Quality Manager keeps it, its members read it).
-- library_sources  the feeds (RSS/Atom) or pages the library-news-ingest Edge
--                  Function checks for the «Νέα» tab. Platform Owner only;
--                  every member reads their state (the «Αυτόματη ενημέρωση» panel).
-- library_news     what the check found (title, link, date, an excerpt of at most
--                  300 characters: never the article itself), plus the hospital's
--                  own announcements (organization_id set).
--
-- Files of the clinical guides (image or PDF) live in the private bucket
-- library-files: platform/<item>/<file> or <organization id>/<item>/<file>.

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  kind text not null default 'link' check (kind in ('link','guideline','clinical_guide')),
  link_group text not null default 'international' check (link_group in ('greek','international','nursing','archive','hospital')),
  name text not null check (length(btrim(name)) > 1),
  abbreviation text check (abbreviation is null or length(abbreviation) <= 8),
  organisation text,
  url text check (url is null or url ~* '^https?://'),
  description_el text check (description_el is null or length(description_el) <= 400),
  description_en text check (description_en is null or length(description_en) <= 400),
  summary_el text,
  summary_en text,
  limoxis_note_el text,
  limoxis_note_en text,
  note_el text,
  note_en text,
  tags text[] not null default '{}',
  year integer check (year is null or year between 1900 and 2100),
  language text not null default 'en' check (language in ('el','en','other')),
  is_proposed boolean not null default false,
  status text not null default 'published' check (status in ('published','archived')),
  file_path text,
  file_name text,
  file_type text,
  sort_order integer not null default 100,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists library_items_org_kind_idx on public.library_items (organization_id, kind, status);

create table if not exists public.library_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.library_items(id) on delete set null,
  name text not null,
  abbreviation text,
  url text not null unique check (url ~* '^https?://'),
  kind text not null default 'rss' check (kind in ('rss','page')),
  interval_hours integer not null default 2 check (interval_hours between 1 and 168),
  keywords text[] not null default '{}',
  active boolean not null default true,
  verified boolean not null default false,
  last_checked_at timestamptz,
  last_ok_at timestamptz,
  last_status integer,
  last_error text,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists library_sources_item_idx on public.library_sources (item_id);

create table if not exists public.library_news (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.library_sources(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  item_key text not null,
  title text not null check (length(btrim(title)) > 1),
  url text check (url is null or url ~* '^https?://'),
  excerpt text check (excerpt is null or length(excerpt) <= 300),
  published_at timestamptz,
  detected_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (source_id, item_key),
  check (source_id is not null or organization_id is not null)
);
create index if not exists library_news_recent_idx on public.library_news (coalesce(published_at, detected_at) desc);
create index if not exists library_news_org_idx on public.library_news (organization_id);

alter table public.library_items enable row level security;
alter table public.library_sources enable row level security;
alter table public.library_news enable row level security;

-- Read: platform rows by every signed-in user; a hospital's rows by its members.
create policy library_items_read on public.library_items for select to authenticated using (
  organization_id is null or (select public.is_org_member(organization_id)));
-- Write: platform rows by the Platform Owner; a hospital's rows by its Hospital Admin or Quality Manager.
create policy library_items_insert on public.library_items for insert to authenticated with check (
  case when organization_id is null then (select public.current_user_is_platform_owner())
  else (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])) end);
create policy library_items_update on public.library_items for update to authenticated
  using (case when organization_id is null then (select public.current_user_is_platform_owner())
    else (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])) end)
  with check (case when organization_id is null then (select public.current_user_is_platform_owner())
    else (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])) end);
create policy library_items_delete on public.library_items for delete to authenticated using (
  case when organization_id is null then (select public.current_user_is_platform_owner())
  else (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])) end);

create policy library_sources_read on public.library_sources for select to authenticated using (true);
create policy library_sources_owner_insert on public.library_sources for insert to authenticated with check ((select public.current_user_is_platform_owner()));
create policy library_sources_owner_update on public.library_sources for update to authenticated
  using ((select public.current_user_is_platform_owner())) with check ((select public.current_user_is_platform_owner()));
create policy library_sources_owner_delete on public.library_sources for delete to authenticated using ((select public.current_user_is_platform_owner()));

create policy library_news_read on public.library_news for select to authenticated using (
  organization_id is null or (select public.is_org_member(organization_id)));
-- What a feed found is written only by the Edge Function (service role); the
-- Platform Owner may remove it. A hospital writes its own announcements.
create policy library_news_insert on public.library_news for insert to authenticated with check (
  source_id is null and organization_id is not null
  and (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])));
create policy library_news_update on public.library_news for update to authenticated
  using (source_id is null and organization_id is not null and (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])))
  with check (source_id is null and organization_id is not null and (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])));
create policy library_news_delete on public.library_news for delete to authenticated using (
  (select public.current_user_is_platform_owner())
  or (source_id is null and organization_id is not null and (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[]))));

revoke all on public.library_items, public.library_sources, public.library_news from anon;
grant select, insert, update, delete on public.library_items, public.library_sources, public.library_news to authenticated;

create or replace trigger trg_library_items_touch before update on public.library_items
  for each row execute function private.department_register_touch();
create or replace trigger trg_library_sources_touch before update on public.library_sources
  for each row execute function private.department_register_touch();

-- The clinical guides' files: images and PDF, at most 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-files', 'library-files', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- platform/… is read by every signed-in user and written by the Platform Owner;
-- <organization id>/… is read by its members and written by its Hospital Admin or Quality Manager.
create policy library_files_read on storage.objects for select to authenticated using (
  bucket_id = 'library-files' and (
    (storage.foldername(name))[1] = 'platform'
    or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and (select public.is_org_member(((storage.foldername(name))[1])::uuid)))));
create policy library_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'library-files' and (
    ((storage.foldername(name))[1] = 'platform' and (select public.current_user_is_platform_owner()))
    or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and (select public.current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hospital_admin','quality_manager']::public.app_role[])))));
create policy library_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'library-files' and (
    ((storage.foldername(name))[1] = 'platform' and (select public.current_user_is_platform_owner()))
    or ((storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and (select public.current_user_has_org_role(((storage.foldername(name))[1])::uuid, array['hospital_admin','quality_manager']::public.app_role[])))));

-- Asks the library-news-ingest Edge Function to check the sources that are due
-- (same Vault secrets as private.platform_dispatch_task). Scheduled by pg_cron
-- once the function is deployed (supabase/maintenance/library_news_schedule.sql).
create or replace function private.platform_dispatch_library_news()
returns bigint language plpgsql security definer set search_path = ''
as $function$
declare
  v_url text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_functions_url');
  v_secret text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'limoxis_scheduler_secret');
begin
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/library-news-ingest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-limoxis-scheduler', v_secret),
    body := jsonb_build_object('task', 'library_watch'),
    timeout_milliseconds := 60000);
end;
$function$;
revoke all on function private.platform_dispatch_library_news() from public, anon, authenticated;
