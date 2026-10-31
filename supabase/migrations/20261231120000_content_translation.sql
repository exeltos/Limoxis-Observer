-- Αυτόματη μετάφραση περιεχομένου, φάση 1 (docs/TRANSLATION_DESIGN.md).
-- Μόνο θεσμικό κείμενο από λίστα επιτρεπόμενων πεδίων· opt-in ανά νοσοκομείο με μηνιαίο όριο χαρακτήρων.
-- Η μετάφραση γράφεται στη στήλη _en του πίνακα-πηγής ΜΟΝΟ όταν αυτή είναι κενή ή περιέχει προηγούμενη αυτόματη μετάφραση·
-- ό,τι έγραψε άνθρωπος (ή υπήρχε ήδη) δεν αντικαθίσταται ποτέ. Φάση 1: library_items, quality_objectives.

-- 1) Ρυθμίσεις ανά νοσοκομείο
create table if not exists public.organization_translation_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  monthly_char_limit integer not null default 200000 check (monthly_char_limit between 0 and 5000000),
  used_month date not null default (date_trunc('month', now()))::date,
  used_chars integer not null default 0 check (used_chars >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.organization_translation_settings enable row level security;
revoke all on public.organization_translation_settings from anon;
grant select on public.organization_translation_settings to authenticated;
create policy translation_settings_read on public.organization_translation_settings for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or (select public.current_user_has_org_role(organization_id, array['hospital_admin','quality_manager']::public.app_role[])));

create or replace function public.get_translation_settings(p_organization_id uuid)
returns table(enabled boolean, monthly_char_limit integer, used_chars integer, provider_ready boolean)
language sql security invoker set search_path = ''
as $$
  select coalesce(s.enabled, false), coalesce(s.monthly_char_limit, 200000),
         case when s.used_month = (date_trunc('month', now()))::date then coalesce(s.used_chars, 0) else 0 end,
         exists (select 1 from public.lira_ai_provider_settings p where p.organization_id = p_organization_id and p.enabled and p.provider <> 'none' and p.secret_id is not null)
  from (select 1) x left join public.organization_translation_settings s on s.organization_id = p_organization_id
  where (select public.current_user_is_platform_owner())
     or (select public.current_user_has_org_role(p_organization_id, array['hospital_admin','quality_manager']::public.app_role[]))
$$;
revoke all on function public.get_translation_settings(uuid) from public, anon;
grant execute on function public.get_translation_settings(uuid) to authenticated;

create or replace function public.set_translation_settings(p_organization_id uuid, p_enabled boolean, p_monthly_char_limit integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not ((select public.current_user_is_platform_owner())
       or (select public.current_user_has_org_role(p_organization_id, array['hospital_admin','quality_manager']::public.app_role[]))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.organization_translation_settings (organization_id, enabled, monthly_char_limit, updated_by, updated_at)
  values (p_organization_id, coalesce(p_enabled, false), least(greatest(coalesce(p_monthly_char_limit, 200000), 0), 5000000), auth.uid(), now())
  on conflict (organization_id) do update
    set enabled = excluded.enabled, monthly_char_limit = excluded.monthly_char_limit, updated_by = excluded.updated_by, updated_at = now();
end;
$$;
revoke all on function public.set_translation_settings(uuid, boolean, integer) from public, anon;
grant execute on function public.set_translation_settings(uuid, boolean, integer) to authenticated;

-- 2) Οι μεταφράσεις: ένα ίχνος ανά πεδίο (η ίδια η μετάφραση ζει στη στήλη _en του πίνακα-πηγής)
create table if not exists public.content_translations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity text not null check (entity in ('library_items', 'quality_objectives')),
  entity_id uuid not null,
  field text not null check (length(field) between 1 and 60),
  lang text not null default 'en' check (lang = 'en'),
  source_hash text not null,
  text text not null,
  origin text not null default 'auto' check (origin in ('auto', 'human')),
  model text,
  translated_at timestamptz not null default now(),
  unique (organization_id, entity, entity_id, field, lang)
);
create index if not exists content_translations_entity_idx on public.content_translations (organization_id, entity, entity_id);
alter table public.content_translations enable row level security;
revoke all on public.content_translations from anon;
grant select on public.content_translations to authenticated;
create policy content_translations_read on public.content_translations for select to authenticated using ((select public.is_org_member(organization_id)));

-- 3) Η ουρά (γράφεται από trigger, καταναλώνεται από την edge function με service role)
create table if not exists public.translation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity text not null check (entity in ('library_items', 'quality_objectives')),
  entity_id uuid not null,
  field text not null,
  source_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity, entity_id, field)
);
create index if not exists translation_jobs_pending_idx on public.translation_jobs (status, updated_at) where status in ('pending', 'failed');
alter table public.translation_jobs enable row level security;
revoke all on public.translation_jobs from anon, authenticated;

-- 4) Trigger: όταν αλλάζει το ελληνικό πεδίο και το νοσοκομείο έχει ενεργοποιήσει τη μετάφραση, μπαίνει εργασία.
--    Ορίσματα: ζεύγη «στήλη_πηγής» (τα _en αντίστοιχα τα βρίσκει η edge function από τη λίστα της).
create or replace function private.queue_translation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := nullif(to_jsonb(new) ->> 'organization_id', '')::uuid;
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_field text; v_text text;
begin
  if v_org is null then return new; end if;
  if not exists (select 1 from public.organization_translation_settings s where s.organization_id = v_org and s.enabled) then return new; end if;
  foreach v_field in array tg_argv loop
    v_text := nullif(btrim(v_new ->> v_field), '');
    if v_text is null then continue; end if;
    if tg_op = 'UPDATE' and (v_old ->> v_field) is not distinct from (v_new ->> v_field) then continue; end if;
    insert into public.translation_jobs (organization_id, entity, entity_id, field, source_hash, status, attempts, last_error, updated_at)
    values (v_org, tg_table_name, (v_new ->> 'id')::uuid, v_field, md5(v_text), 'pending', 0, null, now())
    on conflict (entity, entity_id, field) do update
      set source_hash = excluded.source_hash, status = 'pending', attempts = 0, last_error = null, updated_at = now();
  end loop;
  return new;
end;
$$;
revoke all on function private.queue_translation() from public, anon, authenticated;

create or replace trigger library_items_queue_translation after insert or update on public.library_items
  for each row execute function private.queue_translation('description_el', 'summary_el', 'note_el', 'limoxis_note_el');
create or replace trigger quality_objectives_queue_translation after insert or update on public.quality_objectives
  for each row execute function private.queue_translation('title');

-- 5) Ο προγραμματισμένος έλεγχος (κάθε 10 λεπτά) ζητά από την edge function να ξεκινήσει την ουρά
create or replace function private.translate_content_dispatch()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.translation_jobs where status in ('pending', 'failed') and attempts < 3) then
    perform private.platform_dispatch_task('translate_content');
  end if;
end;
$$;
revoke all on function private.translate_content_dispatch() from public, anon, authenticated;
select cron.schedule('limoxis-translate-content', '*/10 * * * *', 'select private.translate_content_dispatch();');
