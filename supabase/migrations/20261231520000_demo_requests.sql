-- «Ζητήστε παρουσίαση» στη δημόσια Σελίδα παρουσίασης (πριν τη σύνδεση): ο επισκέπτης συμπληρώνει μια φόρμα, το
-- αίτημα αποθηκεύεται εδώ και ειδοποιείται με email η διεύθυνση public_email του platform_settings, μέσω του
-- notification_outbox (το στέλνει το platform-scheduled-tasks, task «send»). Τα αιτήματα τα βλέπει και τα αλλάζει
-- μόνο ο Ιδιοκτήτης Πλατφόρμας (Κονσόλα › Αιτήματα παρουσίασης). Πίνακας της πλατφόρμας, χωρίς οργανισμό, όπως το
-- platform_settings.

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  organization_name text not null check (char_length(organization_name) between 2 and 200),
  role_title text not null check (char_length(role_title) between 2 and 120),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  message text check (message is null or char_length(message) <= 2000),
  language text not null default 'el' check (language in ('el', 'en')),
  privacy_accepted_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);
create index if not exists demo_requests_created_idx on public.demo_requests(created_at desc);
create index if not exists demo_requests_email_created_idx on public.demo_requests(lower(email), created_at desc);
create index if not exists demo_requests_handled_by_idx on public.demo_requests(handled_by);

alter table public.demo_requests enable row level security;

-- Μόνο ο Ιδιοκτήτης Πλατφόρμας διαβάζει και αλλάζει (την κατάσταση). Καμία πολιτική εισαγωγής: νέο αίτημα μπαίνει
-- μόνο από τη submit_demo_request(). Ο ανώνυμος επισκέπτης δεν έχει καμία πολιτική, άρα δεν βλέπει τίποτα.
do $policies$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'demo_requests' and policyname = 'demo_requests_owner_read') then
    create policy demo_requests_owner_read on public.demo_requests for select to authenticated
      using ((select public.current_user_is_platform_owner()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'demo_requests' and policyname = 'demo_requests_owner_update') then
    create policy demo_requests_owner_update on public.demo_requests for update to authenticated
      using ((select public.current_user_is_platform_owner())) with check ((select public.current_user_is_platform_owner()));
  end if;
end
$policies$;
grant select, update on public.demo_requests to authenticated;

-- Κάθε αλλαγή κατάστασης κρατά πότε και ποιος.
create or replace function public.demo_requests_touch()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.handled_at := now();
    new.handled_by := auth.uid();
  end if;
  return new;
end;
$function$;
create or replace trigger demo_requests_touch before update on public.demo_requests
  for each row execute function public.demo_requests_touch();

-- Το αίτημα του επισκέπτη. Ελέγχει μήκη και μορφή email· όταν το κρυφό πεδίο-παγίδα (p_website) είναι γεμάτο,
-- απαντά «εντάξει» χωρίς να αποθηκεύσει τίποτα (ο αυτόματος αποστολέας δεν μαθαίνει ότι κόπηκε). Όριο: 3 αιτήματα
-- ανά email ανά ώρα και 30 συνολικά ανά ώρα.
create or replace function public.submit_demo_request(
  p_full_name text,
  p_organization text,
  p_role text,
  p_email text,
  p_phone text default null,
  p_message text default null,
  p_language text default 'el',
  p_privacy_accepted boolean default false,
  p_website text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_name text := btrim(coalesce(p_full_name, ''));
  v_org text := btrim(coalesce(p_organization, ''));
  v_role text := btrim(coalesce(p_role, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_language text := case when p_language = 'en' then 'en' else 'el' end;
  v_to text;
begin
  -- Η παγίδα: ένας άνθρωπος δεν βλέπει το πεδίο και το αφήνει κενό.
  if nullif(btrim(coalesce(p_website, '')), '') is not null then
    return jsonb_build_object('ok', true);
  end if;
  if char_length(v_name) not between 2 and 120
     or char_length(v_org) not between 2 and 200
     or char_length(v_role) not between 2 and 120
     or char_length(v_email) > 254
     or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(coalesce(v_phone, '')) > 40
     or char_length(coalesce(v_message, '')) > 2000 then
    raise exception 'DEMO_REQUEST_INVALID' using errcode = '22023';
  end if;
  if not coalesce(p_privacy_accepted, false) then
    raise exception 'DEMO_REQUEST_PRIVACY_REQUIRED' using errcode = '22023';
  end if;

  -- Ένα αίτημα τη φορά ανά email, ώστε το όριο να μη ξεπερνιέται με ταυτόχρονες αποστολές.
  perform pg_advisory_xact_lock(hashtext('demo_request:' || v_email));
  if (select count(*) from public.demo_requests r where lower(r.email) = v_email and r.created_at > v_now - interval '1 hour') >= 3
     or (select count(*) from public.demo_requests r where r.created_at > v_now - interval '1 hour') >= 30 then
    raise exception 'DEMO_REQUEST_RATE_LIMIT' using errcode = '54000';
  end if;

  insert into public.demo_requests(id, full_name, organization_name, role_title, email, phone, message, language, privacy_accepted_at, created_at, updated_at)
  values (v_id, v_name, v_org, v_role, v_email, v_phone, v_message, v_language, v_now, v_now, v_now);

  -- Ειδοποίηση στο email της Σελίδας παρουσίασης (Κονσόλα › Οργανισμοί › Ρυθμίσεις).
  v_to := (select nullif(btrim(s.public_email), '') from public.platform_settings s where s.id = 'global');
  if v_to is not null then
    insert into public.notification_outbox(organization_id, recipient_user_id, recipient_email, notification_type, entity_type, entity_id, subject, payload, status, attempts, available_at)
    values (null, null, v_to, 'public_demo_request', 'demo_request', v_id,
      'Αίτημα παρουσίασης: ' || v_org,
      jsonb_build_object('path', '/platform/demo-requests', 'fullName', v_name, 'organizationName', v_org, 'roleTitle', v_role,
        'email', v_email, 'phone', v_phone, 'message', v_message, 'language', v_language),
      'pending', 0, v_now);
    -- Στέλνεται τώρα· αν ο αποστολέας δεν απαντά, το στέλνει η επόμενη προγραμματισμένη εκτέλεση.
    begin
      perform private.platform_dispatch_task('send');
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$function$;

grant execute on function public.submit_demo_request(text, text, text, text, text, text, text, boolean, text) to anon, authenticated;
