-- Surveillance episodes had no backend path to void/delete an erroneous entry,
-- and reopen did not require a reason. surveillance_cases writes are governed
-- by a simple role-based RLS policy (surveillance_cases_write) with no RPC
-- layer and no lifecycle trigger, so this adds a lightweight reason-required
-- guard directly on the table rather than a parallel governance RPC system.

alter table if exists public.surveillance_cases
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;

-- Bring surveillance_cases into the same generic audit trail already used by
-- clinical_assessments, laboratory_samples, etc. (capture_clinical_audit()).
drop trigger if exists audit_surveillance_cases on public.surveillance_cases;
create trigger audit_surveillance_cases after insert or update or delete on public.surveillance_cases for each row execute function public.capture_clinical_audit();

create or replace function public.enforce_surveillance_governance_reason()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if coalesce(trim(new.void_reason),'') = '' then
      raise exception 'VOID_REASON_REQUIRED';
    end if;
    new.voided_at := coalesce(new.voided_at,now());
    new.voided_by := auth.uid();
  end if;

  if new.status = 'active' and old.status in ('closed','cancelled') then
    if coalesce(trim(new.reopen_reason),'') = '' then
      raise exception 'REOPEN_REASON_REQUIRED';
    end if;
    new.reopened_at := coalesce(new.reopened_at,now());
    new.reopened_by := auth.uid();
    new.closed_at := null;
    new.close_reason := null;
    new.closed_by := null;
    new.voided_at := null;
    new.voided_by := null;
    new.void_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_surveillance_governance_reason on public.surveillance_cases;
create trigger enforce_surveillance_governance_reason
before update on public.surveillance_cases
for each row
execute function public.enforce_surveillance_governance_reason();
