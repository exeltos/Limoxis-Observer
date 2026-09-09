create or replace function public.guard_committee_minutes_approval_decision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status <> 'pending' and new.status is distinct from old.status then
    raise exception 'COMMITTEE_APPROVAL_ALREADY_DECIDED';
  end if;

  if new.status = 'rejected' and nullif(btrim(coalesce(new.comment, '')), '') is null then
    raise exception 'COMMITTEE_APPROVAL_REJECTION_COMMENT_REQUIRED';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_committee_minutes_approval_decision() from public;
grant execute on function public.guard_committee_minutes_approval_decision() to authenticated, service_role;

drop trigger if exists trg_guard_committee_minutes_approval_decision on public.committee_minutes_approvals;
create trigger trg_guard_committee_minutes_approval_decision
before update on public.committee_minutes_approvals
for each row execute function public.guard_committee_minutes_approval_decision();
