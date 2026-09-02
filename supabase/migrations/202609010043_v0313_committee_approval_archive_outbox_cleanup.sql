create or replace function public.archive_previous_committee_minutes_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.committee_minutes_approvals;
begin
  select * into v_old
  from public.committee_minutes_approvals
  where meeting_id=new.meeting_id and approver_id=new.approver_id
  for update;

  if found then
    insert into public.committee_minutes_approval_history(
      approval_id,organization_id,committee_id,meeting_id,approver_id,member_id,
      status,comment,requested_at,decided_at
    ) values (
      v_old.id,v_old.organization_id,v_old.committee_id,v_old.meeting_id,v_old.approver_id,v_old.member_id,
      v_old.status,v_old.comment,v_old.requested_at,v_old.decided_at
    );

    update public.notification_outbox
       set status='cancelled',updated_at=now(),last_error=null
     where notification_type='committee_minutes_approval_requested'
       and entity_type='committee_minutes_approval'
       and entity_id=v_old.id
       and recipient_user_id=v_old.approver_id
       and status in ('pending','failed');

    delete from public.committee_minutes_approvals where id=v_old.id;
  end if;
  return new;
end;
$$;

revoke all on function public.archive_previous_committee_minutes_approval() from public,anon,authenticated;
grant execute on function public.archive_previous_committee_minutes_approval() to service_role;
