-- Legislation: the platform keeps a library of the laws, decisions, circulars
-- and standards that apply to hospitals; each hospital keeps its own register of
-- which apply to it and how it complies, requirement by requirement.
--
-- legislation_texts            the Platform Owner's working copy of a text.
-- legislation_text_versions    what hospitals read: every published version, as
--                              a snapshot, with the requirements that changed.
-- legislation_sources          the sources checked automatically (RSS or page)
--                              and the keywords that make a new item worth a look.
-- legislation_candidates       what the check found: waits for the Platform
--                              Owner, who turns it into a text or dismisses it.
-- organization_legislation     a hospital's register: applicable or not, the
--                              version it reviewed, compliance per requirement.
--
-- Nothing reaches hospitals unless the Platform Owner publishes it
-- (legislation_publish). Publishing e-mails the hospital administrators and
-- quality managers; the automatic check e-mails the Platform Owner a digest of
-- what it found, and when a source stops answering.

create table if not exists public.legislation_texts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null check (length(btrim(title)) > 2),
  title_en text,
  kind text not null default 'ministerial_decision' check (kind in ('law','presidential_decree','ministerial_decision','circular','eu_regulation','eu_directive','standard','guideline','other')),
  reference text,
  issuer text,
  issued_on date,
  topics text[] not null default '{}',
  summary text,
  url text,
  status text not null default 'in_force' check (status in ('in_force','amended','repealed')),
  requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements) = 'array'),
  version integer not null default 0,
  published_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legislation_text_versions (
  text_id uuid not null references public.legislation_texts(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  change_note text,
  changed_requirements text[] not null default '{}',
  published_by uuid default auth.uid(),
  published_at timestamptz not null default now(),
  primary key (text_id, version)
);

create table if not exists public.legislation_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  kind text not null default 'rss' check (kind in ('rss','page')),
  keywords text[] not null default '{}',
  active boolean not null default true,
  last_checked_at timestamptz,
  last_status integer,
  last_error text,
  consecutive_failures integer not null default 0,
  failure_notified boolean not null default false,
  seen_keys text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.legislation_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.legislation_sources(id) on delete set null,
  item_key text not null,
  title text not null,
  url text,
  excerpt text,
  published_hint text,
  matched_keywords text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','linked','dismissed')),
  linked_text_id uuid references public.legislation_texts(id) on delete set null,
  note text,
  detected_at timestamptz not null default now(),
  notified_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  unique (source_id, item_key)
);
create index if not exists legislation_candidates_status_idx on public.legislation_candidates (status, detected_at desc);

create table if not exists public.organization_legislation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  text_id uuid not null references public.legislation_texts(id) on delete cascade,
  applicable boolean not null default true,
  accepted_version integer not null default 0,
  responsible text,
  compliance jsonb not null default '{}'::jsonb check (jsonb_typeof(compliance) = 'object'),
  next_review_on date,
  notes text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  updated_at timestamptz not null default now(),
  unique (organization_id, text_id)
);

alter table public.legislation_texts enable row level security;
alter table public.legislation_text_versions enable row level security;
alter table public.legislation_sources enable row level security;
alter table public.legislation_candidates enable row level security;
alter table public.organization_legislation enable row level security;

-- The working copies, sources and candidates: the Platform Owner only.
create policy legislation_texts_owner on public.legislation_texts for all to authenticated
  using ((select public.current_user_is_platform_owner())) with check ((select public.current_user_is_platform_owner()));
create policy legislation_sources_owner on public.legislation_sources for all to authenticated
  using ((select public.current_user_is_platform_owner())) with check ((select public.current_user_is_platform_owner()));
create policy legislation_candidates_owner on public.legislation_candidates for all to authenticated
  using ((select public.current_user_is_platform_owner())) with check ((select public.current_user_is_platform_owner()));
-- Published versions: every signed-in user reads them; written only by legislation_publish.
create policy legislation_text_versions_read on public.legislation_text_versions for select to authenticated using (true);
-- A hospital's register: Quality reads it, Quality management writes it.
create policy organization_legislation_read on public.organization_legislation for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[]));
create policy organization_legislation_manage on public.organization_legislation for all to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]));

revoke all on public.legislation_texts, public.legislation_text_versions, public.legislation_sources, public.legislation_candidates, public.organization_legislation from anon;
grant select, insert, update, delete on public.legislation_texts, public.legislation_sources, public.legislation_candidates, public.organization_legislation to authenticated;
grant select on public.legislation_text_versions to authenticated;

create or replace trigger trg_legislation_texts_touch before update on public.legislation_texts
  for each row execute function private.department_register_touch();
create or replace trigger trg_organization_legislation_touch before update on public.organization_legislation
  for each row execute function private.department_register_touch();

-- Who is e-mailed about a published version: the hospital administrators and
-- quality managers of every live hospital, except those that marked the text
-- as not applying to them.
create or replace function private.legislation_update_recipients(p_text_id uuid)
returns table(organization_id uuid, user_id uuid, email text, full_name text, organization_name text)
language sql stable security definer set search_path = ''
as $function$
  select distinct on (om.organization_id, om.user_id) om.organization_id, om.user_id, coalesce(nullif(btrim(p.contact_email), ''), u.email), coalesce(nullif(btrim(p.full_name), ''), ''), o.name
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  join public.profiles p on p.id = om.user_id
  join auth.users u on u.id = om.user_id
  where om.status = 'active' and om.role = any (array['hospital_admin','quality_manager']::public.app_role[])
    and not coalesce(o.is_demo, false) and o.deletion_scheduled_at is null
    and coalesce(nullif(btrim(p.contact_email), ''), u.email) is not null
    and not exists (select 1 from public.organization_legislation ol where ol.organization_id = om.organization_id and ol.text_id = p_text_id and not ol.applicable);
$function$;
revoke all on function private.legislation_update_recipients(uuid) from public, anon, authenticated;

-- Asks the platform-scheduled-tasks Edge Function to run one task now.
create or replace function private.platform_dispatch_task(p_task text)
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
    url := rtrim(v_url, '/') || '/platform-scheduled-tasks',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-limoxis-scheduler', v_secret),
    body := jsonb_build_object('task', p_task),
    timeout_milliseconds := 60000);
end;
$function$;
revoke all on function private.platform_dispatch_task(text) from public, anon, authenticated;

-- Publishes the working copy as a new version: hospitals see it as an update,
-- with the requirements that changed, and their quality people are e-mailed.
create or replace function public.legislation_publish(p_text_id uuid, p_change_note text)
returns integer language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_text public.legislation_texts;
  v_previous jsonb;
  v_version integer;
  v_changed text[];
  v_snapshot jsonb;
begin
  if auth.uid() is null or not public.current_user_is_platform_owner() then raise exception 'LEGISLATION_NOT_ALLOWED'; end if;
  select * into v_text from public.legislation_texts where id = p_text_id for update;
  if v_text.id is null then raise exception 'LEGISLATION_TEXT_UNKNOWN'; end if;
  if jsonb_array_length(v_text.requirements) = 0 then raise exception 'LEGISLATION_NO_REQUIREMENTS'; end if;
  select snapshot into v_previous from public.legislation_text_versions where text_id = p_text_id order by version desc limit 1;
  -- A requirement changed when it is new or its wording differs from the last published version.
  select coalesce(array_agg(r->>'id'), '{}') into v_changed
  from jsonb_array_elements(v_text.requirements) r
  where v_previous is null or not exists (
    select 1 from jsonb_array_elements(coalesce(v_previous->'requirements', '[]'::jsonb)) o
    where o->>'id' = r->>'id' and o->>'text' is not distinct from r->>'text');
  v_version := v_text.version + 1;
  v_snapshot := jsonb_build_object('code', v_text.code, 'title', v_text.title, 'titleEn', v_text.title_en, 'kind', v_text.kind, 'reference', v_text.reference,
    'issuer', v_text.issuer, 'issuedOn', v_text.issued_on, 'topics', to_jsonb(v_text.topics), 'summary', v_text.summary, 'url', v_text.url,
    'status', v_text.status, 'requirements', v_text.requirements);
  insert into public.legislation_text_versions (text_id, version, snapshot, change_note, changed_requirements)
    values (p_text_id, v_version, v_snapshot, nullif(btrim(coalesce(p_change_note, '')), ''), v_changed);
  update public.legislation_texts set version = v_version, published_at = now() where id = p_text_id;

  insert into public.notification_outbox(organization_id, recipient_user_id, recipient_email, notification_type, entity_type, entity_id, subject, payload, status, attempts, available_at)
  select r.organization_id, r.user_id, r.email, 'legislation_update', 'legislation:v' || v_version, p_text_id,
    case when v_version = 1 then 'Νέα νομοθεσία: ' || v_text.title else 'Ενημέρωση νομοθεσίας: ' || v_text.title end,
    jsonb_build_object('kind', case when v_version = 1 then 'new' else 'update' end, 'title', v_text.title, 'code', v_text.code, 'reference', v_text.reference,
      'version', v_version, 'changeNote', nullif(btrim(coalesce(p_change_note, '')), ''), 'changed', coalesce(array_length(v_changed, 1), 0),
      'status', v_text.status, 'recipientName', r.full_name, 'organizationName', r.organization_name, 'path', '/legislation/' || p_text_id::text, 'language', 'el'),
    'pending', 0, now()
  from private.legislation_update_recipients(p_text_id) r
  on conflict (notification_type, entity_type, entity_id, recipient_user_id) do nothing;
  perform private.platform_dispatch_task('send');
  return v_version;
end;
$function$;
revoke all on function public.legislation_publish(uuid, text) from public, anon;
grant execute on function public.legislation_publish(uuid, text) to authenticated;

-- Lets the Platform Owner start a check of the sources from the screen.
create or replace function public.legislation_check_now()
returns boolean language plpgsql volatile security definer set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.current_user_is_platform_owner() then raise exception 'LEGISLATION_NOT_ALLOWED'; end if;
  return private.platform_dispatch_task('legislation_watch') is not null;
end;
$function$;
revoke all on function public.legislation_check_now() from public, anon;
grant execute on function public.legislation_check_now() to authenticated;

-- The starting sources and keywords; the Platform Owner changes them on screen.
insert into public.legislation_sources (name, url, kind, keywords) values
  ('e-nomothesia.gr · νέα νομοθεσία', 'https://www.e-nomothesia.gr/rss.xml', 'rss',
    array['λοιμωξ','νοσοκομει','νοσηλευτικ','υγειονομικ','υγειας','υγειονομικων μοναδων','αποβλητ','ΕΑΑΜ','αποστειρωσ','απολυμαν','λεγιονελλ','νερου ανθρωπινης καταναλωσης','αντιμικροβιακ','αντιβιοτικ','εμβολι','ΕΟΔΥ','ασφαλεια ασθενων','ιατροτεχνολογικ','φαρμακ','τροφιμ','HACCP','διαπιστευσ','ποιοτητα']),
  ('Υπουργείο Υγείας · ανακοινώσεις', 'https://www.moh.gov.gr/articles/news', 'page',
    array['λοιμωξ','νοσοκομει','εγκυκλι','αποβλητ','αποστειρωσ','απολυμαν','λεγιονελλ','αντιμικροβιακ','εμβολι','ασφαλεια ασθενων','ποιοτητα','οδηγι']),
  ('ΕΟΔΥ · ανακοινώσεις', 'https://eody.gov.gr/', 'page',
    array['λοιμωξ','νοσοκομει','εγκυκλι','οδηγι','αντιμικροβιακ','πολυανθεκτ','εμβολι','λεγιονελλ','εξαρσ','επιδημ']),
  ('WHO · news', 'https://www.who.int/rss-feeds/news-english.xml', 'rss',
    array['infection prevention','healthcare-associated','antimicrobial resistance','hand hygiene','sterilization','legionella','patient safety','outbreak'])
on conflict (url) do nothing;

-- Every 2 hours the sources are checked (a feed lists only its latest items); every morning the Platform Owner gets
-- a digest of what was found (only when something was).
select cron.schedule('limoxis-legislation-watch', '23 */2 * * *', 'select private.platform_dispatch_task(''legislation_watch'');');
select cron.schedule('limoxis-legislation-digest', '47 4 * * *', 'select private.platform_dispatch_task(''legislation_digest'');');
