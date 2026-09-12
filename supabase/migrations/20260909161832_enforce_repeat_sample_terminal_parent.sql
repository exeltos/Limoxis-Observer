create or replace function public.enforce_repeat_sample_terminal_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_status text;
  parent_org uuid;
  parent_patient uuid;
begin
  if new.parent_sample_id is null then
    return new;
  end if;

  if new.parent_sample_id = new.id then
    raise exception 'A sample cannot repeat itself.';
  end if;

  select status, organization_id, patient_id
    into parent_status, parent_org, parent_patient
  from public.laboratory_samples
  where id = new.parent_sample_id;

  if not found then
    raise exception 'Parent sample does not exist.';
  end if;

  if parent_org is distinct from new.organization_id or parent_patient is distinct from new.patient_id then
    raise exception 'Repeat sample must belong to the same organization and patient.';
  end if;

  if parent_status not in ('completed','rejected') then
    raise exception 'Repeat sample is allowed only from a completed or rejected sample.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_repeat_sample_terminal_parent on public.laboratory_samples;
create trigger trg_enforce_repeat_sample_terminal_parent
before insert or update of parent_sample_id on public.laboratory_samples
for each row execute function public.enforce_repeat_sample_terminal_parent();
