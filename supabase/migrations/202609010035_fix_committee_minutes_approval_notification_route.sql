create or replace function public.queue_committee_minutes_approval_notification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_scheduled_at timestamptz;
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

  select m.scheduled_at, c.name
    into v_scheduled_at, v_committee_name
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
      'scheduledAt', v_scheduled_at,
      'path', '/committees/' || new.committee_id::text
    )
  )
  on conflict (notification_type, entity_type, entity_id, recipient_user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_committee_minutes_approval_notification() from public, anon, authenticated;
grant execute on function public.queue_committee_minutes_approval_notification() to service_role;
