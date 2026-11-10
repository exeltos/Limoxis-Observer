-- Ασφάλεια συνδέσεων (Ιδιοκτήτης Πλατφόρμας, 9/11/2026: «θέλω ο owner να ξέρει ανά πάσα στιγμή ποιος χρήστης
-- συνδέθηκε, με ποια IP και για πόση ώρα … να είμαστε αυστηροί γιατί υπάρχει hacking»).
--
--   platform_login_sessions   μία γραμμή ανά σύνδεση (auth.sessions): χρήστης, IP, συσκευή, έναρξη, τελευταία
--                             δραστηριότητα, λήξη. Γεμίζει από trigger στο auth.sessions (το auth κρατά μόνο τις
--                             τρέχουσες συνδέσεις) και από το username-login, που γράφει την πραγματική IP του χρήστη.
--   platform_login_attempts   κάθε προσπάθεια σύνδεσης από τη φόρμα (επιτυχία ή λάθος κωδικός), μόνο από το
--                             Edge Function username-login με service role.
--   platform_login_locks      κλείδωμα: 5 λάθη σε 15 λεπτά για ένα όνομα χρήστη/email ή 20 από μία IP → 15 λεπτά.
--   touch_login_session()     η εφαρμογή, όσο είναι ανοιχτή, δηλώνει ότι η σύνδεση είναι ζωντανή· επιστρέφει false
--                             όταν ο Ιδιοκτήτης τερμάτισε τη σύνδεση, ώστε η εφαρμογή να αποσυνδέσει αμέσως.
--   platform_login_sessions_list / platform_end_login_sessions / platform_release_login_lock
--                             μόνο για τον Ιδιοκτήτη Πλατφόρμας (current_user_is_platform_owner()).
-- Όλοι οι πίνακες: RLS, ανάγνωση μόνο από τον Ιδιοκτήτη· καμία εγγραφή από τον browser.

create table if not exists public.platform_login_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  ip text,
  last_ip text,
  user_agent text,
  aal text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text,
  ended_by uuid
);
create index if not exists platform_login_sessions_started_idx on public.platform_login_sessions (started_at desc);
create index if not exists platform_login_sessions_user_idx on public.platform_login_sessions (user_id, started_at desc);
create index if not exists platform_login_sessions_open_idx on public.platform_login_sessions (last_seen_at desc) where ended_at is null;
alter table public.platform_login_sessions enable row level security;
create policy platform_login_sessions_owner_read on public.platform_login_sessions
  for select to authenticated using (public.current_user_is_platform_owner());

create table if not exists public.platform_login_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,
  user_id uuid,
  ip text,
  user_agent text,
  success boolean not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists platform_login_attempts_created_idx on public.platform_login_attempts (created_at desc);
create index if not exists platform_login_attempts_identifier_idx on public.platform_login_attempts (identifier, created_at desc);
create index if not exists platform_login_attempts_ip_idx on public.platform_login_attempts (ip, created_at desc);
alter table public.platform_login_attempts enable row level security;
create policy platform_login_attempts_owner_read on public.platform_login_attempts
  for select to authenticated using (public.current_user_is_platform_owner());

create table if not exists public.platform_login_locks (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('account', 'ip')),
  subject text not null,
  failures integer not null default 0,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid
);
create index if not exists platform_login_locks_subject_idx on public.platform_login_locks (kind, subject, locked_until desc);
create index if not exists platform_login_locks_created_idx on public.platform_login_locks (created_at desc);
alter table public.platform_login_locks enable row level security;
create policy platform_login_locks_owner_read on public.platform_login_locks
  for select to authenticated using (public.current_user_is_platform_owner());

-- auth.sessions → platform_login_sessions. Ποτέ δεν σταματά μια σύνδεση: κάθε σφάλμα αγνοείται.
create or replace function public.platform_track_auth_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  begin
    if tg_op = 'INSERT' then
      insert into public.platform_login_sessions (session_id, user_id, ip, last_ip, user_agent, aal, started_at, last_seen_at)
      values (new.id, new.user_id, host(new.ip), host(new.ip), left(new.user_agent, 400), new.aal::text,
              coalesce(new.created_at, now()), coalesce(new.created_at, now()))
      on conflict (session_id) do nothing;
    elsif tg_op = 'UPDATE' then
      update public.platform_login_sessions
         set last_seen_at = greatest(last_seen_at, coalesce(new.refreshed_at::timestamptz, new.updated_at, now())),
             aal = new.aal::text
       where session_id = new.id;
    elsif tg_op = 'DELETE' then
      update public.platform_login_sessions
         set ended_at = coalesce(ended_at, now()),
             ended_reason = coalesce(ended_reason, 'signed_out')
       where session_id = old.id;
    end if;
  exception when others then
    null;
  end;
  return coalesce(new, old);
end;
$function$;

revoke all on function public.platform_track_auth_session() from public, anon, authenticated;

create or replace trigger platform_track_auth_session
  after insert or update or delete on auth.sessions
  for each row execute function public.platform_track_auth_session();

-- Οι συνδέσεις που υπάρχουν ήδη.
insert into public.platform_login_sessions (session_id, user_id, ip, last_ip, user_agent, aal, started_at, last_seen_at)
select s.id, s.user_id, host(s.ip), host(s.ip), left(s.user_agent, 400), s.aal::text, s.created_at,
       greatest(s.created_at, coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at))
  from auth.sessions s
on conflict (session_id) do nothing;

-- Η εφαρμογή, κάθε λίγα λεπτά όσο είναι ανοιχτή: «η σύνδεσή μου είναι ζωντανή».
-- false = η σύνδεση τερματίστηκε (από τον Ιδιοκτήτη ή έληξε) → η εφαρμογή αποσυνδέει.
create or replace function public.touch_login_session()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_session uuid;
  v_ip text;
  v_ended timestamptz;
begin
  if v_user is null then
    return false;
  end if;
  begin
    v_session := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when others then
    v_session := null;
  end;
  if v_session is null then
    return true;
  end if;
  if not exists (select 1 from auth.sessions s where s.id = v_session and s.user_id = v_user) then
    update public.platform_login_sessions
       set ended_at = coalesce(ended_at, now()), ended_reason = coalesce(ended_reason, 'expired')
     where session_id = v_session and user_id = v_user;
    return false;
  end if;
  begin
    v_ip := nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  exception when others then
    v_ip := null;
  end;
  update public.platform_login_sessions
     set last_seen_at = now(), last_ip = coalesce(left(v_ip, 64), last_ip)
   where session_id = v_session and user_id = v_user
  returning ended_at into v_ended;
  return v_ended is null;
end;
$function$;

revoke all on function public.touch_login_session() from public, anon;
grant execute on function public.touch_login_session() to authenticated;

-- Ο Ιδιοκτήτης: οι συνδέσεις των τελευταίων ημερών με τον χρήστη και τους οργανισμούς του.
create or replace function public.platform_login_sessions_list(p_days integer default 30, p_limit integer default 1000)
returns table (
  session_id uuid, user_id uuid, full_name text, username text, email text, is_platform_owner boolean,
  organizations text, ip text, last_ip text, user_agent text, aal text,
  started_at timestamptz, last_seen_at timestamptz, ended_at timestamptz, ended_reason text,
  active boolean, online boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.current_user_is_platform_owner() then
    raise exception 'PLATFORM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  return query
  select l.session_id, l.user_id, p.full_name, p.username, coalesce(p.contact_email, u.email::text), coalesce(p.is_platform_owner, false),
         (select string_agg(distinct o.name, ' · ') from public.organization_members m join public.organizations o on o.id = m.organization_id where m.user_id = l.user_id),
         l.ip, l.last_ip, l.user_agent, l.aal, l.started_at, l.last_seen_at, l.ended_at, l.ended_reason,
         (l.ended_at is null and exists (select 1 from auth.sessions s where s.id = l.session_id)),
         (l.ended_at is null and l.last_seen_at > now() - interval '10 minutes' and exists (select 1 from auth.sessions s where s.id = l.session_id))
    from public.platform_login_sessions l
    left join public.profiles p on p.id = l.user_id
    left join auth.users u on u.id = l.user_id
   where l.started_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 400))
      or l.ended_at is null
   order by l.started_at desc
   limit least(greatest(coalesce(p_limit, 1000), 1), 5000);
end;
$function$;

revoke all on function public.platform_login_sessions_list(integer, integer) from public, anon;
grant execute on function public.platform_login_sessions_list(integer, integer) to authenticated;

-- Ο Ιδιοκτήτης τερματίζει μία σύνδεση (p_session_id) ή όλες τις συνδέσεις ενός χρήστη (p_user_id).
-- Το refresh token ακυρώνεται αμέσως· η εφαρμογή του χρήστη αποσυνδέεται στον επόμενο έλεγχο (touch_login_session).
create or replace function public.platform_end_login_sessions(p_session_id uuid default null, p_user_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_owner uuid := auth.uid();
  v_count integer := 0;
  v_target uuid;
begin
  if not public.current_user_is_platform_owner() then
    raise exception 'PLATFORM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_session_id is null and p_user_id is null then
    raise exception 'SESSION_OR_USER_REQUIRED' using errcode = '22023';
  end if;
  v_target := coalesce(p_user_id, (select l.user_id from public.platform_login_sessions l where l.session_id = p_session_id));
  update public.platform_login_sessions l
     set ended_at = coalesce(l.ended_at, now()), ended_reason = 'ended_by_owner', ended_by = v_owner
   where l.ended_at is null
     and ((p_session_id is not null and l.session_id = p_session_id) or (p_session_id is null and l.user_id = p_user_id));
  get diagnostics v_count = row_count;
  delete from auth.sessions s
   where (p_session_id is not null and s.id = p_session_id) or (p_session_id is null and s.user_id = p_user_id);
  insert into public.system_audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (null, v_owner, 'platform_session_end', 'profile', v_target::text,
          jsonb_build_object('session_id', p_session_id, 'all_sessions', p_session_id is null, 'ended', v_count));
  return v_count;
end;
$function$;

revoke all on function public.platform_end_login_sessions(uuid, uuid) from public, anon;
grant execute on function public.platform_end_login_sessions(uuid, uuid) to authenticated;

-- Ο Ιδιοκτήτης ξεκλειδώνει ένα όνομα χρήστη ή μια IP πριν λήξει το κλείδωμα.
create or replace function public.platform_release_login_lock(p_lock_id bigint)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_owner uuid := auth.uid();
begin
  if not public.current_user_is_platform_owner() then
    raise exception 'PLATFORM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  update public.platform_login_locks set released_at = now(), released_by = v_owner
   where id = p_lock_id and released_at is null;
  if not found then
    return false;
  end if;
  insert into public.system_audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (null, v_owner, 'platform_login_unlock', 'login_lock', p_lock_id::text, '{}'::jsonb);
  return true;
end;
$function$;

revoke all on function public.platform_release_login_lock(bigint) from public, anon;
grant execute on function public.platform_release_login_lock(bigint) to authenticated;
