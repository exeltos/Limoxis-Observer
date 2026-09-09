create or replace function public.sync_committee_approval_notification_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status='pending' and new.status in ('approved','rejected','cancelled') then
    update public.notification_outbox
       set status='cancelled',updated_at=now(),last_error=null
     where notification_type='committee_minutes_approval_requested'
       and entity_type='committee_minutes_approval'
       and entity_id=new.id
       and recipient_user_id=new.approver_id
       and status in ('pending','failed');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_committee_approval_notification_outbox() from public,anon,authenticated;
grant execute on function public.sync_committee_approval_notification_outbox() to service_role;

drop trigger if exists trg_sync_committee_approval_notification_outbox on public.committee_minutes_approvals;
create trigger trg_sync_committee_approval_notification_outbox
after update of status on public.committee_minutes_approvals
for each row execute function public.sync_committee_approval_notification_outbox();
