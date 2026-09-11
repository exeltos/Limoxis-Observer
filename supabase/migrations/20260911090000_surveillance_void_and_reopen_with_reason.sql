-- Surveillance episodes had no backend path to void/delete an erroneous entry,
-- and reopen did not require or capture a reason. Add a void_surveillance_case
-- RPC mirroring close_surveillance_case, and make reopen_surveillance_case take
-- a mandatory reason (matching the deletion audit-trail pattern already used
-- in the demo product). Also audit surveillance_cases itself: only the
-- sub-tables were captured by capture_clinical_audit() until now.

alter table if exists public.surveillance_cases
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;

drop trigger if exists audit_surveillance_cases on public.surveillance_cases;
create trigger audit_surveillance_cases after insert or update or delete on public.surveillance_cases for each row execute function public.capture_clinical_audit();

create or replace function public.void_surveillance_case(p_case_id uuid,p_reason text)
returns public.surveillance_cases
language plpgsql security definer
set search_path = ''
as $$
declare
  v_case public.surveillance_cases;
begin
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'VOID_REASON_REQUIRED';
  end if;

  select * into v_case from public.surveillance_cases where id = p_case_id;
  if v_case.id is null then raise exception 'Surveillance case not found'; end if;

  if not public.current_user_can_surveillance_capability(v_case.organization_id,v_case.department_id,v_case.id,'delete_surveillance') then
    raise exception 'Surveillance void denied';
  end if;

  if v_case.status = 'cancelled' then raise exception 'Surveillance case is already voided'; end if;

  update public.surveillance_cases
  set status='cancelled',voided_at=now(),voided_by=auth.uid(),void_reason=trim(p_reason),updated_at=now()
  where id=p_case_id
  returning * into v_case;
  return v_case;
end;
$$;

revoke all on function public.void_surveillance_case(uuid,text) from public;
grant execute on function public.void_surveillance_case(uuid,text) to authenticated;

-- Reopen now requires a reason and also accepts a voided ('cancelled') case,
-- not only a closed one. The old reason-less overload is retired.
drop function if exists public.reopen_surveillance_case(uuid);

create or replace function public.reopen_surveillance_case(p_case_id uuid,p_reason text)
returns public.surveillance_cases
language plpgsql security definer
set search_path = ''
as $$
declare
  v_case public.surveillance_cases;
begin
  if coalesce(trim(p_reason),'') = '' then
    raise exception 'REOPEN_REASON_REQUIRED';
  end if;

  select * into v_case from public.surveillance_cases where id = p_case_id;
  if v_case.id is null then raise exception 'Surveillance case not found'; end if;
  if not public.current_user_can_surveillance_capability(v_case.organization_id,v_case.department_id,v_case.id,'reopen_surveillance') then
    raise exception 'Surveillance reopen denied';
  end if;
  if v_case.status not in ('closed','cancelled') then raise exception 'Only closed or voided surveillance cases can be reopened'; end if;

  update public.surveillance_cases
  set status='active',
      closed_at=null,closed_by=null,close_reason=null,
      voided_at=null,voided_by=null,void_reason=null,
      reopened_at=now(),reopened_by=auth.uid(),reopen_reason=trim(p_reason),
      updated_at=now()
  where id=p_case_id
  returning * into v_case;
  return v_case;
end;
$$;

revoke all on function public.reopen_surveillance_case(uuid,text) from public;
grant execute on function public.reopen_surveillance_case(uuid,text) to authenticated;

-- The lifecycle guard must recognize the void/reopen-from-void transitions and
-- the new metadata columns, in addition to the existing close/reopen pair.
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

  if new.status = old.status then
    if new.closed_at is distinct from old.closed_at
       or new.closed_by is distinct from old.closed_by
       or new.close_reason is distinct from old.close_reason
       or new.voided_at is distinct from old.voided_at
       or new.voided_by is distinct from old.voided_by
       or new.void_reason is distinct from old.void_reason
       or new.reopened_at is distinct from old.reopened_at
       or new.reopened_by is distinct from old.reopened_by
       or new.reopen_reason is distinct from old.reopen_reason then
      raise exception 'Surveillance lifecycle metadata can only change during a status transition';
    end if;
    return new;
  end if;

  if old.status = 'active' and new.status = 'closed' then
    if not public.current_user_can_surveillance_capability(old.organization_id,old.department_id,old.id,'close_surveillance') then
      raise exception 'Not authorized to close surveillance case';
    end if;
    new.closed_at := coalesce(new.closed_at,now());
    new.closed_by := auth.uid();

  elsif old.status in ('active','closed') and new.status = 'cancelled' then
    if not public.current_user_can_surveillance_capability(old.organization_id,old.department_id,old.id,'delete_surveillance') then
      raise exception 'Not authorized to void surveillance case';
    end if;
    new.voided_at := coalesce(new.voided_at,now());
    new.voided_by := auth.uid();

  elsif old.status in ('closed','cancelled') and new.status = 'active' then
    if not public.current_user_can_surveillance_capability(old.organization_id,old.department_id,old.id,'reopen_surveillance') then
      raise exception 'Not authorized to reopen surveillance case';
    end if;
    new.closed_at := null;
    new.closed_by := null;
    new.close_reason := null;
    new.voided_at := null;
    new.voided_by := null;
    new.void_reason := null;
    new.reopened_at := coalesce(new.reopened_at,now());
    new.reopened_by := auth.uid();

  else
    raise exception 'Unsupported surveillance lifecycle transition: % -> %',old.status,new.status;
  end if;

  return new;
end;
$$;
