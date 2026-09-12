alter table public.committee_members add column if not exists updated_at timestamptz not null default now();

create or replace function public.finalize_committee_meeting_after_approvals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    if not exists (
      select 1 from public.committee_minutes_approvals a
      where a.meeting_id = new.meeting_id
        and a.status not in ('approved','cancelled')
    ) and exists (
      select 1 from public.committee_minutes_approvals a
      where a.meeting_id = new.meeting_id and a.status = 'approved'
    ) then
      update public.committee_meetings
      set status='finalized',
          finalized_at=coalesce(finalized_at,now()),
          finalized_by=coalesce(finalized_by,new.approver_id),
          updated_at=now()
      where id=new.meeting_id
        and committee_id=new.committee_id
        and organization_id=new.organization_id
        and status='approval_pending';

      if found then
        insert into public.committee_history(committee_id,organization_id,action,reason,event_data,actor_id)
        values(new.committee_id,new.organization_id,'Οριστικοποίηση πρακτικών','Όλες οι απαιτούμενες εγκρίσεις ολοκληρώθηκαν',jsonb_build_object('meeting_id',new.meeting_id,'auto_finalized',true),new.approver_id);
      end if;
    end if;
  end if;
  return new;
end;
$$;
