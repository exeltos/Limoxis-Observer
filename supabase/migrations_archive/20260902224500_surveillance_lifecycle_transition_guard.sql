-- Prevent generic surveillance UPDATE permission from bypassing close/reopen governance.
-- Lifecycle transitions are capability-checked at the database boundary even when a
-- client issues a direct UPDATE instead of using the convenience RPCs.

create or replace function public.guard_surveillance_case_lifecycle_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Surveillance case organization cannot be changed';
  end if;

  if old.status = 'active' and new.status = 'closed' then
    if not public.current_user_can_surveillance_capability(
      old.organization_id,
      old.department_id,
      old.id,
      'close_surveillance'
    ) then
      raise exception 'Not authorized to close surveillance case';
    end if;

    new.closed_at := coalesce(new.closed_at,now());
    new.closed_by := auth.uid();

  elsif old.status = 'closed' and new.status = 'active' then
    if not public.current_user_can_surveillance_capability(
      old.organization_id,
      old.department_id,
      old.id,
      'reopen_surveillance'
    ) then
      raise exception 'Not authorized to reopen surveillance case';
    end if;

    new.closed_at := null;
    new.closed_by := null;
    new.close_reason := null;

  elsif new.status is distinct from old.status then
    raise exception 'Unsupported surveillance lifecycle transition: % -> %',old.status,new.status;

  elsif new.closed_at is distinct from old.closed_at
     or new.closed_by is distinct from old.closed_by
     or new.close_reason is distinct from old.close_reason then
    raise exception 'Surveillance lifecycle metadata can only change during close/reopen transitions';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_surveillance_case_lifecycle_transition() from public;

-- Trigger functions are invoked by PostgreSQL, not called directly by clients.
drop trigger if exists guard_surveillance_case_lifecycle_transition on public.surveillance_cases;
create trigger guard_surveillance_case_lifecycle_transition
before update on public.surveillance_cases
for each row
execute function public.guard_surveillance_case_lifecycle_transition();
