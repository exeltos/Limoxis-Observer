create or replace function public.cancel_committee_meeting(p_meeting_id uuid,p_reason text)
returns public.committee_meetings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_meeting public.committee_meetings;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  if v_reason is null then
    raise exception 'COMMITTEE_MEETING_CANCELLATION_REASON_REQUIRED';
  end if;

  select * into v_meeting
  from public.committee_meetings
  where id=p_meeting_id;

  if not found then
    raise exception 'COMMITTEE_MEETING_NOT_FOUND';
  end if;

  if not public.current_user_can_manage_committee(v_meeting.organization_id,v_meeting.committee_id,'create_committee_meeting') then
    raise exception 'PERMISSION_DENIED';
  end if;

  update public.committee_meetings
  set status='cancelled',
      cancellation_reason=v_reason,
      updated_at=now()
  where id=p_meeting_id
    and status in ('draft','planned','in_progress')
  returning * into v_meeting;

  if not found then
    raise exception 'COMMITTEE_MEETING_CANCELLATION_NOT_ALLOWED';
  end if;

  insert into public.committee_history(organization_id,committee_id,action,reason,event_data)
  values(v_meeting.organization_id,v_meeting.committee_id,'Ακύρωση συνεδρίασης',v_reason,jsonb_build_object('meeting_id',v_meeting.id,'client_key',v_meeting.client_key));

  return v_meeting;
end;
$$;

revoke all on function public.cancel_committee_meeting(uuid,text) from public, anon;
grant execute on function public.cancel_committee_meeting(uuid,text) to authenticated, service_role;