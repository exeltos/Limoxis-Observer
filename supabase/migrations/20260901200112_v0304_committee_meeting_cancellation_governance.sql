alter table public.committee_meetings
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid;

create or replace function public.guard_committee_meeting_cancellation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if old.status not in ('draft','planned','in_progress') then
      raise exception 'COMMITTEE_MEETING_CANCELLATION_NOT_ALLOWED';
    end if;
    if nullif(btrim(coalesce(new.cancellation_reason,'')),'') is null then
      raise exception 'COMMITTEE_MEETING_CANCELLATION_REASON_REQUIRED';
    end if;
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
  elsif old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    raise exception 'COMMITTEE_MEETING_CANCELLED_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_committee_meeting_cancellation on public.committee_meetings;
create trigger trg_guard_committee_meeting_cancellation
before update of status,cancellation_reason,cancelled_at,cancelled_by on public.committee_meetings
for each row
execute function public.guard_committee_meeting_cancellation();

drop policy if exists committee_meetings_cancel on public.committee_meetings;
create policy committee_meetings_cancel on public.committee_meetings
for update to authenticated
using (
  status in ('draft','planned','in_progress')
  and public.current_user_can_manage_committee(organization_id,committee_id,'create_committee_meeting')
)
with check (
  status='cancelled'
  and nullif(btrim(coalesce(cancellation_reason,'')),'') is not null
  and cancelled_at is not null
  and cancelled_by=auth.uid()
  and public.current_user_can_manage_committee(organization_id,committee_id,'create_committee_meeting')
);