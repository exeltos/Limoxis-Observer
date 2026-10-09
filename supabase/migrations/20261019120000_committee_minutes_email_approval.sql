-- Minutes approval by members without a Limoxis account (approved by the
-- platform owner). Until now a present voting member without an account
-- blocked the submission (COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED).
-- Now the secretariat chooses, for each such member:
--   * email: a personal, single-use link (valid 7 days) to a public page where
--     the member approves or requests changes, without signing in;
--   * paper: the member signed the printed minutes; the secretariat records it.
-- Members with an account approve inside the platform, as before. The minutes
-- are finalized when no approval is pending in either table.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

create table if not exists public.committee_minutes_external_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  member_id uuid references public.committee_members(id) on delete set null,
  member_name text not null,
  method text not null check (method in ('email', 'paper')),
  email text,
  token_hash text unique,
  token_expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  comment text,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  send_count integer not null default 0,
  decided_at timestamptz,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint committee_minutes_external_meeting_tenant_fk foreign key (meeting_id, organization_id, committee_id)
    references public.committee_meetings(id, organization_id, committee_id) on delete cascade,
  constraint committee_minutes_external_email_check check (method <> 'email' or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);
create index if not exists committee_minutes_external_meeting_idx on public.committee_minutes_external_approvals(meeting_id, status);
create index if not exists committee_minutes_external_org_idx on public.committee_minutes_external_approvals(organization_id);

alter table public.committee_minutes_external_approvals enable row level security;
-- Read only; every change goes through the functions below.
create policy committee_minutes_external_approvals_read on public.committee_minutes_external_approvals
  for select to authenticated using ((select public.current_user_can_view_committee(organization_id, committee_id)));
revoke all on public.committee_minutes_external_approvals from anon;
grant select on public.committee_minutes_external_approvals to authenticated;

-- Finalize the meeting when nothing is pending in either table and at least
-- one approval exists.
create or replace function private.committee_minutes_try_finalize(p_meeting_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_meeting public.committee_meetings;
begin
  if exists (select 1 from public.committee_minutes_approvals a where a.meeting_id = p_meeting_id and a.status not in ('approved', 'cancelled'))
     or exists (select 1 from public.committee_minutes_external_approvals x where x.meeting_id = p_meeting_id and x.status not in ('approved', 'cancelled')) then
    return;
  end if;
  if not exists (select 1 from public.committee_minutes_approvals a where a.meeting_id = p_meeting_id and a.status = 'approved')
     and not exists (select 1 from public.committee_minutes_external_approvals x where x.meeting_id = p_meeting_id and x.status = 'approved') then
    return;
  end if;
  update public.committee_meetings m
     set status = 'finalized', finalized_at = coalesce(m.finalized_at, now()), finalized_by = coalesce(m.finalized_by, p_actor), updated_at = now()
   where m.id = p_meeting_id and m.status = 'approval_pending';
  if found then
    v_meeting := (select m from public.committee_meetings m where m.id = p_meeting_id);
    insert into public.committee_history(committee_id, organization_id, action, reason, event_data, actor_id)
    values (v_meeting.committee_id, v_meeting.organization_id, 'Οριστικοποίηση πρακτικών', 'Όλες οι απαιτούμενες εγκρίσεις ολοκληρώθηκαν',
      jsonb_build_object('meeting_id', p_meeting_id, 'auto_finalized', true), p_actor);
  end if;
end;
$function$;
revoke all on function private.committee_minutes_try_finalize(uuid, uuid) from public, anon, authenticated;

create or replace function public.finalize_committee_meeting_after_approvals()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    perform private.committee_minutes_try_finalize(new.meeting_id, new.approver_id);
  end if;
  return new;
end;
$function$;

-- A request for changes (from an account) also withdraws the e-mail links.
create or replace function public.return_committee_minutes_for_revision()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status = 'rejected' and old.status = 'pending' then
    update public.committee_minutes_approvals
       set status = 'cancelled', updated_at = now()
     where organization_id = new.organization_id and committee_id = new.committee_id and meeting_id = new.meeting_id
       and id <> new.id and status = 'pending';
    update public.committee_minutes_external_approvals
       set status = 'cancelled', token_hash = null, updated_at = now()
     where meeting_id = new.meeting_id and status = 'pending';

    update public.committee_meetings
       set status = 'draft', finalized_at = null, finalized_by = null, updated_at = now()
     where id = new.meeting_id and committee_id = new.committee_id and organization_id = new.organization_id and status = 'approval_pending';

    insert into public.committee_history(organization_id, committee_id, action, reason, event_data, actor_id)
    values (new.organization_id, new.committee_id, 'Αίτημα διορθώσεων πρακτικών', new.comment,
      jsonb_build_object('meeting_id', new.meeting_id, 'approval_id', new.id, 'revision_required', true), new.approver_id);
  end if;
  return new;
end;
$function$;

-- Decisions on the external table: finalize, or send the minutes back.
create or replace function private.committee_minutes_external_after_decision()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected', 'cancelled') then
    update public.notification_outbox o
       set status = 'cancelled', updated_at = now(), last_error = null
     where o.notification_type = 'committee_minutes_external_approval' and o.entity_type = 'committee_minutes_external_approval'
       and o.entity_id = new.id and o.status in ('pending', 'failed');
  end if;
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.committee_history(organization_id, committee_id, action, reason, event_data, actor_id)
    values (new.organization_id, new.committee_id,
      case when new.method = 'paper' then 'Υπογραφή πρακτικών σε χαρτί' else 'Έγκριση πρακτικών μέσω email' end,
      new.member_name || case when new.method = 'email' then ' · ' || coalesce(new.email, '') else '' end,
      jsonb_build_object('meeting_id', new.meeting_id, 'external_approval_id', new.id, 'method', new.method, 'external', true),
      coalesce(new.recorded_by, new.requested_by));
    perform private.committee_minutes_try_finalize(new.meeting_id, coalesce(new.recorded_by, new.requested_by));
  elsif new.status = 'rejected' and old.status = 'pending' then
    update public.committee_minutes_approvals
       set status = 'cancelled', updated_at = now()
     where meeting_id = new.meeting_id and status = 'pending';
    update public.committee_minutes_external_approvals
       set status = 'cancelled', token_hash = null, updated_at = now()
     where meeting_id = new.meeting_id and id <> new.id and status = 'pending';
    update public.committee_meetings
       set status = 'draft', finalized_at = null, finalized_by = null, updated_at = now()
     where id = new.meeting_id and status = 'approval_pending';
    insert into public.committee_history(organization_id, committee_id, action, reason, event_data, actor_id)
    values (new.organization_id, new.committee_id, 'Αίτημα διορθώσεων πρακτικών', new.member_name || ' (email): ' || coalesce(new.comment, ''),
      jsonb_build_object('meeting_id', new.meeting_id, 'external_approval_id', new.id, 'revision_required', true, 'external', true), new.requested_by);
  end if;
  return new;
end;
$function$;
revoke all on function private.committee_minutes_external_after_decision() from public, anon, authenticated;

create trigger committee_minutes_external_after_decision
  after update of status on public.committee_minutes_external_approvals
  for each row execute function private.committee_minutes_external_after_decision();

-- One e-mail request: a fresh token (only its hash is stored) and the outbox row.
create or replace function private.committee_minutes_external_issue_link(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.committee_minutes_external_approvals;
  v_token text := 'CMA-' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_meeting public.committee_meetings;
  v_committee public.committees;
  v_org_name text;
  v_payload jsonb;
  v_outbox uuid;
begin
  v_row := (select x from public.committee_minutes_external_approvals x where x.id = p_id);
  if v_row.id is null or v_row.method <> 'email' or v_row.status <> 'pending' then
    raise exception 'COMMITTEE_MINUTES_EXTERNAL_NOT_PENDING';
  end if;
  v_meeting := (select m from public.committee_meetings m where m.id = v_row.meeting_id);
  v_committee := (select c from public.committees c where c.id = v_row.committee_id);
  v_org_name := (select o.name from public.organizations o where o.id = v_row.organization_id);

  update public.committee_minutes_external_approvals x
     set token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), token_expires_at = now() + interval '7 days',
         sent_at = now(), send_count = x.send_count + 1, updated_at = now()
   where x.id = p_id;

  v_payload := jsonb_build_object('path', '/minutes-approval/' || v_token, 'memberName', v_row.member_name,
    'committeeName', coalesce(v_committee.name, ''), 'organizationName', coalesce(v_org_name, ''),
    'meetingTitle', coalesce(v_meeting.title, ''), 'scheduledAt', v_meeting.scheduled_at, 'minutesNumber', coalesce(v_meeting.minutes_number, ''),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('subject', t->>'subject', 'decision', t->>'decision'))
                        from jsonb_array_elements(case when jsonb_typeof(v_meeting.agenda) = 'array' then v_meeting.agenda else '[]'::jsonb end) t
                        where nullif(btrim(coalesce(t->>'subject', '')), '') is not null), '[]'::jsonb),
    'expiresAt', now() + interval '7 days', 'language', 'el');
  v_outbox := (select o.id from public.notification_outbox o
               where o.notification_type = 'committee_minutes_external_approval' and o.entity_type = 'committee_minutes_external_approval' and o.entity_id = p_id
               order by o.created_at desc limit 1);
  if v_outbox is null then
    insert into public.notification_outbox(organization_id, recipient_user_id, recipient_email, notification_type, entity_type, entity_id, subject, payload, status, attempts, available_at)
    values (v_row.organization_id, null, v_row.email, 'committee_minutes_external_approval', 'committee_minutes_external_approval', p_id,
      'Έγκριση πρακτικών: ' || coalesce(v_committee.name, ''), v_payload, 'pending', 0, now());
  else
    update public.notification_outbox o
       set recipient_email = v_row.email, subject = 'Έγκριση πρακτικών: ' || coalesce(v_committee.name, ''), payload = v_payload,
           status = 'pending', attempts = 0, available_at = now(), sent_at = null, last_error = null, updated_at = now()
     where o.id = v_outbox;
  end if;
end;
$function$;
revoke all on function private.committee_minutes_external_issue_link(uuid) from public, anon, authenticated;

-- Submission. p_external: [{member_id, method: 'email' | 'paper', email}] for
-- the present voting members without an account; every one of them must be
-- covered, otherwise COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED (DETAIL lists them).
create or replace function public.submit_committee_minutes(p_meeting_id uuid, p_external jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_meeting public.committee_meetings;
  v_approval_count integer := 0;
  v_email_count integer := 0;
  v_paper_count integer := 0;
  v_missing jsonb;
  v_external jsonb := case when jsonb_typeof(p_external) = 'array' then p_external else '[]'::jsonb end;
  r record;
begin
  v_meeting := (select m from public.committee_meetings m where m.id = p_meeting_id for update);
  if v_meeting.id is null then
    raise exception 'COMMITTEE_MEETING_NOT_FOUND';
  end if;
  if not public.current_user_can_manage_committee(v_meeting.organization_id, v_meeting.committee_id, 'finalize_committee_minutes') then
    raise exception 'PERMISSION_DENIED';
  end if;
  if v_meeting.status not in ('draft', 'planned', 'in_progress') then
    raise exception 'COMMITTEE_MINUTES_SUBMISSION_NOT_ALLOWED';
  end if;

  -- Present voting members without an account that the caller did not cover.
  v_missing := (
    select coalesce(jsonb_agg(jsonb_build_object('memberId', a.member_id, 'name', a.attendee_name) order by a.attendee_name), '[]'::jsonb)
    from public.committee_meeting_attendance a
    left join public.committee_members m on m.id = a.member_id and m.organization_id = a.organization_id and m.committee_id = a.committee_id
    where a.meeting_id = v_meeting.id and a.organization_id = v_meeting.organization_id and a.committee_id = v_meeting.committee_id
      and a.attendance_status = 'present' and coalesce(a.has_vote, true)
      and m.user_id is null
      and not exists (
        select 1 from jsonb_array_elements(v_external) e
        where a.member_id is not null and e->>'member_id' = a.member_id::text
          and (e->>'method' = 'paper' or (e->>'method' = 'email' and coalesce(e->>'email', '') ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'))));
  if jsonb_array_length(v_missing) > 0 then
    raise exception 'COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED' using detail = v_missing::text;
  end if;

  -- A new submission replaces whatever was still pending.
  update public.committee_minutes_approvals
     set status = 'cancelled', updated_at = now()
   where organization_id = v_meeting.organization_id and committee_id = v_meeting.committee_id and meeting_id = v_meeting.id and status = 'pending';
  update public.committee_minutes_external_approvals
     set status = 'cancelled', token_hash = null, updated_at = now()
   where meeting_id = v_meeting.id and status = 'pending';

  -- Members with an account approve inside the platform.
  insert into public.committee_minutes_approvals(organization_id, committee_id, meeting_id, approver_id, member_id, status, requested_by)
  select v_meeting.organization_id, v_meeting.committee_id, v_meeting.id, x.user_id, x.member_id, 'pending', auth.uid()
  from (
    select distinct on (m.user_id) m.user_id, m.id as member_id
    from public.committee_meeting_attendance a
    join public.committee_members m on m.id = a.member_id and m.organization_id = a.organization_id and m.committee_id = a.committee_id
    where a.organization_id = v_meeting.organization_id and a.committee_id = v_meeting.committee_id and a.meeting_id = v_meeting.id
      and a.attendance_status = 'present' and coalesce(a.has_vote, true) and m.user_id is not null
    order by m.user_id, m.started_at desc nulls last, m.id
  ) x;
  get diagnostics v_approval_count = row_count;

  -- Members without an account: e-mail link or signature on paper.
  for r in
    select distinct on (a.member_id) a.member_id, coalesce(m.member_name, a.attendee_name) as member_name, e->>'method' as method, lower(btrim(e->>'email')) as email
    from public.committee_meeting_attendance a
    join public.committee_members m on m.id = a.member_id and m.organization_id = a.organization_id and m.committee_id = a.committee_id
    join lateral (select e from jsonb_array_elements(v_external) e where e->>'member_id' = a.member_id::text limit 1) ext on true
    where a.meeting_id = v_meeting.id and a.organization_id = v_meeting.organization_id and a.committee_id = v_meeting.committee_id
      and a.attendance_status = 'present' and coalesce(a.has_vote, true) and m.user_id is null
    order by a.member_id
  loop
    if r.method = 'paper' then
      insert into public.committee_minutes_external_approvals(organization_id, committee_id, meeting_id, member_id, member_name, method, email, status, requested_by, decided_at, recorded_by)
      values (v_meeting.organization_id, v_meeting.committee_id, v_meeting.id, r.member_id, r.member_name, 'paper', nullif(r.email, ''), 'approved', auth.uid(), now(), auth.uid());
      v_paper_count := v_paper_count + 1;
    else
      insert into public.committee_minutes_external_approvals(organization_id, committee_id, meeting_id, member_id, member_name, method, email, status, requested_by)
      values (v_meeting.organization_id, v_meeting.committee_id, v_meeting.id, r.member_id, r.member_name, 'email', r.email, 'pending', auth.uid());
      v_email_count := v_email_count + 1;
    end if;
  end loop;

  if v_approval_count + v_email_count > 0 then
    update public.committee_meetings
       set status = 'approval_pending', finalized_at = null, finalized_by = null, updated_at = now()
     where id = v_meeting.id;
    for r in select x.id from public.committee_minutes_external_approvals x where x.meeting_id = v_meeting.id and x.status = 'pending' and x.method = 'email' loop
      perform private.committee_minutes_external_issue_link(r.id);
    end loop;
    insert into public.committee_history(organization_id, committee_id, action, reason, event_data, actor_id)
    values (v_meeting.organization_id, v_meeting.committee_id, 'Υποβολή πρακτικών για έγκριση', v_meeting.title,
      jsonb_build_object('meeting_id', v_meeting.id, 'approval_count', v_approval_count, 'email_count', v_email_count, 'paper_count', v_paper_count), auth.uid());
    if v_paper_count > 0 then
      insert into public.committee_history(organization_id, committee_id, action, reason, event_data, actor_id)
      select v_meeting.organization_id, v_meeting.committee_id, 'Υπογραφή πρακτικών σε χαρτί', x.member_name,
        jsonb_build_object('meeting_id', v_meeting.id, 'external_approval_id', x.id, 'method', 'paper', 'external', true), auth.uid()
      from public.committee_minutes_external_approvals x where x.meeting_id = v_meeting.id and x.method = 'paper' and x.status = 'approved' and x.decided_at >= now() - interval '1 minute';
    end if;
    return jsonb_build_object('status', 'approval_pending', 'approvalCount', v_approval_count + v_email_count, 'emailCount', v_email_count, 'paperCount', v_paper_count, 'finalizedAt', null);
  end if;

  update public.committee_meetings
     set status = 'finalized', finalized_at = now(), finalized_by = auth.uid(), updated_at = now()
   where id = v_meeting.id;
  v_meeting := (select m from public.committee_meetings m where m.id = p_meeting_id);
  insert into public.committee_history(organization_id, committee_id, action, reason, event_data, actor_id)
  values (v_meeting.organization_id, v_meeting.committee_id, 'Οριστικοποίηση πρακτικών', v_meeting.title,
    jsonb_build_object('meeting_id', v_meeting.id, 'approval_count', 0, 'paper_count', v_paper_count, 'auto_finalized', true), auth.uid());
  return jsonb_build_object('status', 'finalized', 'approvalCount', 0, 'emailCount', 0, 'paperCount', v_paper_count, 'finalizedAt', v_meeting.finalized_at);
end;
$function$;
revoke all on function public.submit_committee_minutes(uuid, jsonb) from public, anon;
grant execute on function public.submit_committee_minutes(uuid, jsonb) to authenticated;

-- The previous entry point keeps working (no members without an account).
create or replace function public.submit_committee_minutes_for_approval(p_meeting_id uuid)
returns jsonb language plpgsql set search_path to 'public', 'pg_temp'
as $function$
begin
  return public.submit_committee_minutes(p_meeting_id, '[]'::jsonb);
end;
$function$;

-- Secretariat actions on a pending e-mail request.
create or replace function public.committee_minutes_external_action(p_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.committee_minutes_external_approvals;
begin
  v_row := (select x from public.committee_minutes_external_approvals x where x.id = p_id);
  if v_row.id is null then
    raise exception 'COMMITTEE_MINUTES_EXTERNAL_NOT_FOUND';
  end if;
  if not public.current_user_can_manage_committee(v_row.organization_id, v_row.committee_id, 'finalize_committee_minutes') then
    raise exception 'PERMISSION_DENIED';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'COMMITTEE_MINUTES_EXTERNAL_NOT_PENDING';
  end if;
  if p_action = 'resend' then
    perform private.committee_minutes_external_issue_link(p_id);
  elsif p_action = 'paper' then
    update public.committee_minutes_external_approvals x
       set method = 'paper', status = 'approved', token_hash = null, decided_at = now(), recorded_by = auth.uid(), updated_at = now()
     where x.id = p_id;
  else
    raise exception 'COMMITTEE_MINUTES_EXTERNAL_ACTION_INVALID';
  end if;
  return jsonb_build_object('ok', true, 'action', p_action);
end;
$function$;
revoke all on function public.committee_minutes_external_action(uuid, text) from public, anon;
grant execute on function public.committee_minutes_external_action(uuid, text) to authenticated;

-- Public page (no account): what the link shows.
create or replace function public.committee_minutes_external_access(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_row public.committee_minutes_external_approvals;
  v_meeting public.committee_meetings;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then
    raise exception 'MINUTES_ACCESS_NOT_AVAILABLE';
  end if;
  v_row := (select x from public.committee_minutes_external_approvals x where x.token_hash = encode(sha256(convert_to(btrim(p_token), 'UTF8')), 'hex'));
  if v_row.id is null then
    raise exception 'MINUTES_ACCESS_NOT_AVAILABLE';
  end if;
  v_meeting := (select m from public.committee_meetings m where m.id = v_row.meeting_id);
  return jsonb_build_object(
    'status', case when v_row.status = 'pending' and v_row.token_expires_at < now() then 'expired' else v_row.status end,
    'memberName', v_row.member_name,
    'organizationName', (select o.name from public.organizations o where o.id = v_row.organization_id),
    'committeeName', (select c.name from public.committees c where c.id = v_row.committee_id),
    'meetingTitle', v_meeting.title, 'scheduledAt', v_meeting.scheduled_at, 'location', v_meeting.location,
    'minutesNumber', v_meeting.minutes_number, 'quorumMet', v_meeting.quorum_met, 'notes', v_meeting.minutes,
    'topics', coalesce((select jsonb_agg(jsonb_build_object('subject', t->>'subject', 'decision', t->>'decision', 'action', t->>'action', 'owner', t->>'owner', 'dueDate', t->>'dueDate'))
                        from jsonb_array_elements(case when jsonb_typeof(v_meeting.agenda) = 'array' then v_meeting.agenda else '[]'::jsonb end) t
                        where nullif(btrim(coalesce(t->>'subject', '')), '') is not null), '[]'::jsonb),
    'attendees', coalesce((select jsonb_agg(a.attendee_name order by a.attendee_name) from public.committee_meeting_attendance a
                           where a.meeting_id = v_meeting.id and a.attendance_status = 'present'), '[]'::jsonb),
    'expiresAt', v_row.token_expires_at, 'decidedAt', v_row.decided_at, 'comment', v_row.comment);
end;
$function$;
revoke all on function public.committee_minutes_external_access(text) from public;
grant execute on function public.committee_minutes_external_access(text) to anon, authenticated;

create or replace function public.committee_minutes_external_decide(p_token text, p_decision text, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.committee_minutes_external_approvals;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'MINUTES_DECISION_INVALID';
  end if;
  if p_decision = 'rejected' and nullif(btrim(coalesce(p_comment, '')), '') is null then
    raise exception 'COMMITTEE_APPROVAL_REJECTION_COMMENT_REQUIRED';
  end if;
  v_row := (select x from public.committee_minutes_external_approvals x
            where x.token_hash = encode(sha256(convert_to(btrim(coalesce(p_token, '')), 'UTF8')), 'hex') for update);
  if v_row.id is null then
    raise exception 'MINUTES_ACCESS_NOT_AVAILABLE';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'MINUTES_ALREADY_DECIDED';
  end if;
  if v_row.token_expires_at < now() then
    raise exception 'MINUTES_ACCESS_EXPIRED';
  end if;
  if not exists (select 1 from public.committee_meetings m where m.id = v_row.meeting_id and m.status = 'approval_pending') then
    raise exception 'MINUTES_ACCESS_NOT_AVAILABLE';
  end if;
  -- The link is single use: the hash stays only to show the answer again.
  update public.committee_minutes_external_approvals x
     set status = p_decision, comment = nullif(btrim(coalesce(p_comment, '')), ''), decided_at = now(), updated_at = now()
   where x.id = v_row.id;
  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$function$;
revoke all on function public.committee_minutes_external_decide(text, text, text) from public;
grant execute on function public.committee_minutes_external_decide(text, text, text) to anon, authenticated;

-- The meeting guard: a voting member without an account is covered by an
-- e-mail or paper approval of the same meeting; minutes signed on paper by
-- every voting member may be finalized straight away.
create or replace function public.guard_committee_meeting_finalization()
returns trigger language plpgsql set search_path to 'public'
as $function$
declare
  has_voting_present boolean;
  has_missing_account boolean;
  all_signed_on_paper boolean;
begin
  if new.status not in ('approval_pending', 'finalized') or new.status is not distinct from old.status then
    return new;
  end if;

  has_voting_present := exists (
    select 1 from public.committee_meeting_attendance a
    where a.organization_id = new.organization_id and a.committee_id = new.committee_id and a.meeting_id = new.id
      and a.attendance_status = 'present' and coalesce(a.has_vote, true) = true);
  if not has_voting_present then
    return new;
  end if;

  has_missing_account := exists (
    select 1 from public.committee_meeting_attendance a
    left join public.committee_members m on m.id = a.member_id and m.organization_id = a.organization_id and m.committee_id = a.committee_id
    where a.organization_id = new.organization_id and a.committee_id = new.committee_id and a.meeting_id = new.id
      and a.attendance_status = 'present' and coalesce(a.has_vote, true) = true
      and (a.member_id is null or m.user_id is null)
      and not exists (select 1 from public.committee_minutes_external_approvals x
                      where x.meeting_id = new.id and x.member_id = a.member_id and x.status in ('pending', 'approved')));
  if has_missing_account then
    raise exception 'COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED';
  end if;

  if new.status = 'finalized' and old.status <> 'approval_pending' then
    all_signed_on_paper := not exists (
      select 1 from public.committee_meeting_attendance a
      where a.organization_id = new.organization_id and a.committee_id = new.committee_id and a.meeting_id = new.id
        and a.attendance_status = 'present' and coalesce(a.has_vote, true) = true
        and not exists (select 1 from public.committee_minutes_external_approvals x
                        where x.meeting_id = new.id and x.member_id = a.member_id and x.method = 'paper' and x.status = 'approved'));
    if not all_signed_on_paper then
      raise exception 'COMMITTEE_MINUTES_APPROVAL_REQUIRED';
    end if;
  end if;

  return new;
end;
$function$;
