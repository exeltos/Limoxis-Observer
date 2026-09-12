create or replace function public.submit_committee_minutes_for_approval(p_meeting_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_meeting public.committee_meetings;
  v_voting_count integer := 0;
  v_approval_count integer := 0;
  v_missing_account boolean := false;
begin
  select * into v_meeting
  from public.committee_meetings
  where id=p_meeting_id
  for update;

  if not found then
    raise exception 'COMMITTEE_MEETING_NOT_FOUND';
  end if;

  if not public.current_user_can_manage_committee(v_meeting.organization_id,v_meeting.committee_id,'finalize_committee_minutes') then
    raise exception 'PERMISSION_DENIED';
  end if;

  if v_meeting.status not in ('draft','planned','in_progress') then
    raise exception 'COMMITTEE_MINUTES_SUBMISSION_NOT_ALLOWED';
  end if;

  select count(*), coalesce(bool_or(a.member_id is null or m.id is null or m.user_id is null),false)
    into v_voting_count,v_missing_account
  from public.committee_meeting_attendance a
  left join public.committee_members m
    on m.id=a.member_id
   and m.organization_id=a.organization_id
   and m.committee_id=a.committee_id
  where a.organization_id=v_meeting.organization_id
    and a.committee_id=v_meeting.committee_id
    and a.meeting_id=v_meeting.id
    and a.attendance_status='present'
    and coalesce(a.has_vote,true)=true;

  if v_missing_account then
    raise exception 'COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED';
  end if;

  update public.committee_minutes_approvals
     set status='cancelled',updated_at=now()
   where organization_id=v_meeting.organization_id
     and committee_id=v_meeting.committee_id
     and meeting_id=v_meeting.id
     and status='pending';

  if v_voting_count > 0 then
    insert into public.committee_minutes_approvals(
      organization_id,committee_id,meeting_id,approver_id,member_id,status,requested_by
    )
    select v_meeting.organization_id,v_meeting.committee_id,v_meeting.id,x.user_id,x.member_id,'pending',auth.uid()
    from (
      select distinct on (m.user_id) m.user_id,m.id as member_id
      from public.committee_meeting_attendance a
      join public.committee_members m
        on m.id=a.member_id
       and m.organization_id=a.organization_id
       and m.committee_id=a.committee_id
      where a.organization_id=v_meeting.organization_id
        and a.committee_id=v_meeting.committee_id
        and a.meeting_id=v_meeting.id
        and a.attendance_status='present'
        and coalesce(a.has_vote,true)=true
        and m.user_id is not null
      order by m.user_id,m.started_at desc nulls last,m.id
    ) x;

    get diagnostics v_approval_count = row_count;

    update public.committee_meetings
       set status='approval_pending',finalized_at=null,finalized_by=null,updated_at=now()
     where id=v_meeting.id;

    insert into public.committee_history(organization_id,committee_id,action,reason,event_data,actor_id)
    values(
      v_meeting.organization_id,v_meeting.committee_id,'Υποβολή πρακτικών για έγκριση',v_meeting.title,
      jsonb_build_object('meeting_id',v_meeting.id,'approval_count',v_approval_count),auth.uid()
    );

    return jsonb_build_object('status','approval_pending','approvalCount',v_approval_count,'finalizedAt',null);
  end if;

  update public.committee_meetings
     set status='finalized',finalized_at=now(),finalized_by=auth.uid(),updated_at=now()
   where id=v_meeting.id
   returning * into v_meeting;

  insert into public.committee_history(organization_id,committee_id,action,reason,event_data,actor_id)
  values(
    v_meeting.organization_id,v_meeting.committee_id,'Οριστικοποίηση πρακτικών',v_meeting.title,
    jsonb_build_object('meeting_id',v_meeting.id,'approval_count',0,'auto_finalized',true),auth.uid()
  );

  return jsonb_build_object('status','finalized','approvalCount',0,'finalizedAt',v_meeting.finalized_at);
end;
$$;

revoke all on function public.submit_committee_minutes_for_approval(uuid) from public,anon;
grant execute on function public.submit_committee_minutes_for_approval(uuid) to authenticated,service_role;
