create or replace function public.enforce_microbiology_result_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.validation_status in ('validated','amended') and (
    new.result_status is distinct from old.result_status or
    new.organism is distinct from old.organism or
    new.resistance_class is distinct from old.resistance_class or
    new.susceptibility_summary is distinct from old.susceptibility_summary or
    new.resulted_at is distinct from old.resulted_at or
    new.method is distinct from old.method or
    new.preliminary is distinct from old.preliminary or
    new.validation_status is distinct from old.validation_status or
    new.validated_by is distinct from old.validated_by or
    new.validated_at is distinct from old.validated_at or
    new.amended_from is distinct from old.amended_from or
    new.interpretation_standard is distinct from old.interpretation_standard or
    new.interpretation_version is distinct from old.interpretation_version
  ) then
    raise exception 'Validated microbiology results are immutable; create an amendment instead.' using errcode='23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_microbiology_result_immutability() from public, anon, authenticated;

drop trigger if exists trg_microbiology_result_immutability on public.microbiology_results;
create trigger trg_microbiology_result_immutability
before update on public.microbiology_results
for each row execute function public.enforce_microbiology_result_immutability();
