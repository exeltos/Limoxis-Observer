create table if not exists public.committee_minutes_approval_history (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  committee_id uuid not null references public.committees(id) on delete cascade,
  meeting_id uuid not null references public.committee_meetings(id) on delete cascade,
  approver_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid references public.committee_members(id) on delete set null,
  status text not null,
  comment text,
  requested_at timestamptz,
  decided_at timestamptz,
  archived_at timestamptz not null default now()
);

create index if not exists committee_minutes_approval_history_meeting_idx
  on public.committee_minutes_approval_history(organization_id,committee_id,meeting_id,archived_at desc);

alter table public.committee_minutes_approval_history enable row level security;
revoke all on table public.committee_minutes_approval_history from public,anon,authenticated;
grant select,insert,update,delete on table public.committee_minutes_approval_history to service_role;

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

    delete from public.committee_minutes_approvals where id=v_old.id;
  end if;
  return new;
end;
$$;

revoke all on function public.archive_previous_committee_minutes_approval() from public,anon,authenticated;
grant execute on function public.archive_previous_committee_minutes_approval() to service_role;

drop trigger if exists committee_minutes_archive_previous_approval on public.committee_minutes_approvals;
create trigger committee_minutes_archive_previous_approval
before insert on public.committee_minutes_approvals
for each row execute function public.archive_previous_committee_minutes_approval();

create or replace function public.return_committee_minutes_for_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status='rejected' and old.status='pending' then
    update public.committee_minutes_approvals
       set status='cancelled',updated_at=now()
     where organization_id=new.organization_id
       and committee_id=new.committee_id
       and meeting_id=new.meeting_id
       and id<>new.id
       and status='pending';

    update public.committee_meetings
       set status='draft',finalized_at=null,finalized_by=null,updated_at=now()
     where id=new.meeting_id
       and committee_id=new.committee_id
       and organization_id=new.organization_id
       and status='approval_pending';

    insert into public.committee_history(organization_id,committee_id,action,reason,event_data,actor_id)
    values(
      new.organization_id,new.committee_id,'Αίτημα διορθώσεων πρακτικών',new.comment,
      jsonb_build_object('meeting_id',new.meeting_id,'approval_id',new.id,'revision_required',true),
      new.approver_id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.return_committee_minutes_for_revision() from public,anon,authenticated;
grant execute on function public.return_committee_minutes_for_revision() to service_role;

drop trigger if exists committee_minutes_return_for_revision on public.committee_minutes_approvals;
create trigger committee_minutes_return_for_revision
after update of status on public.committee_minutes_approvals
for each row execute function public.return_committee_minutes_for_revision();
