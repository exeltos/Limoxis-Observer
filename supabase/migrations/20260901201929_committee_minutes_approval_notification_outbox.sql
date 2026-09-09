create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  notification_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_type, entity_type, entity_id, recipient_user_id)
);

alter table public.notification_outbox enable row level security;

revoke all on table public.notification_outbox from anon, authenticated;
grant select on table public.notification_outbox to service_role;
grant insert, update, delete on table public.notification_outbox to service_role;

create or replace function public.queue_committee_minutes_approval_notification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_meeting_date date;
  v_committee_name text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select coalesce(p.contact_email, u.email)
    into v_email
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = new.approver_id;

  if nullif(trim(coalesce(v_email,'')), '') is null then
    return new;
  end if;

  select m.meeting_date, c.name
    into v_meeting_date, v_committee_name
    from public.committee_meetings m
    join public.committees c on c.id = m.committee_id
   where m.id = new.meeting_id;

  insert into public.notification_outbox(
    organization_id, recipient_user_id, recipient_email,
    notification_type, entity_type, entity_id, subject, payload
  ) values (
    new.organization_id, new.approver_id, v_email,
    'committee_minutes_approval_requested', 'committee_minutes_approval', new.id,
    'Απαιτείται έγκριση πρακτικών',
    jsonb_build_object(
      'approvalId', new.id,
      'committeeId', new.committee_id,
      'meetingId', new.meeting_id,
      'committeeName', coalesce(v_committee_name,''),
      'meetingDate', v_meeting_date,
      'path', '/committees/' || new.committee_id::text || '/meetings/' || new.meeting_id::text
    )
  )
  on conflict (notification_type, entity_type, entity_id, recipient_user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_committee_minutes_approval_notification() from public, anon, authenticated;
grant execute on function public.queue_committee_minutes_approval_notification() to service_role;

drop trigger if exists trg_queue_committee_minutes_approval_notification on public.committee_minutes_approvals;
create trigger trg_queue_committee_minutes_approval_notification
after insert on public.committee_minutes_approvals
for each row execute function public.queue_committee_minutes_approval_notification();

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox(status, available_at, created_at)
  where status in ('pending','failed');

create index if not exists notification_outbox_recipient_idx
  on public.notification_outbox(recipient_user_id, created_at desc);
