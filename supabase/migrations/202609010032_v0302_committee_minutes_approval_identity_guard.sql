create or replace function public.guard_committee_minutes_approval_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.committee_id is distinct from old.committee_id
     or new.meeting_id is distinct from old.meeting_id
     or new.approver_id is distinct from old.approver_id
     or new.member_id is distinct from old.member_id
     or new.requested_by is distinct from old.requested_by
     or new.requested_at is distinct from old.requested_at
     or new.created_at is distinct from old.created_at then
    raise exception 'COMMITTEE_MINUTES_APPROVAL_IDENTITY_IMMUTABLE';
  end if;

  if old.status = 'pending' and new.status not in ('approved','rejected','cancelled') then
    raise exception 'COMMITTEE_MINUTES_APPROVAL_TRANSITION_INVALID';
  end if;

  if old.status <> 'pending' and new.status is distinct from old.status then
    raise exception 'COMMITTEE_MINUTES_APPROVAL_ALREADY_DECIDED';
  end if;

  if new.status in ('approved','rejected') and new.decided_at is null then
    raise exception 'COMMITTEE_MINUTES_APPROVAL_DECISION_TIME_REQUIRED';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_committee_minutes_approval_update on public.committee_minutes_approvals;
create trigger trg_guard_committee_minutes_approval_update
before update on public.committee_minutes_approvals
for each row execute function public.guard_committee_minutes_approval_update();

revoke all on function public.guard_committee_minutes_approval_update() from public;
revoke all on function public.guard_committee_minutes_approval_update() from anon;
grant execute on function public.guard_committee_minutes_approval_update() to authenticated;
grant execute on function public.guard_committee_minutes_approval_update() to service_role;
