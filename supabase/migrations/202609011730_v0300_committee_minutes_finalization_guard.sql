create or replace function public.guard_committee_meeting_finalization()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  has_voting_present boolean;
  has_missing_account boolean;
begin
  if new.status not in ('approval_pending','finalized') or new.status is not distinct from old.status then
    return new;
  end if;

  select exists (
    select 1
    from public.committee_meeting_attendance a
    where a.organization_id = new.organization_id
      and a.committee_id = new.committee_id
      and a.meeting_id = new.id
      and a.attendance_status = 'present'
      and coalesce(a.has_vote, true) = true
  ) into has_voting_present;

  if not has_voting_present then
    return new;
  end if;

  select exists (
    select 1
    from public.committee_meeting_attendance a
    left join public.committee_members m
      on m.id = a.member_id
     and m.organization_id = a.organization_id
     and m.committee_id = a.committee_id
    where a.organization_id = new.organization_id
      and a.committee_id = new.committee_id
      and a.meeting_id = new.id
      and a.attendance_status = 'present'
      and coalesce(a.has_vote, true) = true
      and (a.member_id is null or m.user_id is null)
  ) into has_missing_account;

  if has_missing_account then
    raise exception 'COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED';
  end if;

  if new.status = 'finalized' and old.status <> 'approval_pending' then
    raise exception 'COMMITTEE_MINUTES_APPROVAL_REQUIRED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_committee_meeting_finalization on public.committee_meetings;
create trigger trg_guard_committee_meeting_finalization
before update of status on public.committee_meetings
for each row
execute function public.guard_committee_meeting_finalization();
