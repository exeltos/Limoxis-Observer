alter table public.microbiology_results
  add column if not exists organisms jsonb not null default '[]'::jsonb;

alter table public.antimicrobial_susceptibility_results
  add column if not exists organism_name text;

alter table public.antimicrobial_susceptibility_results
  drop constraint if exists antimicrobial_susceptibility__microbiology_result_id_antimi_key;

alter table public.antimicrobial_susceptibility_results
  add constraint antimicrobial_susceptibility_result_organism_antimicrobial_key unique (microbiology_result_id, organism_name, antimicrobial_name);

create or replace function public.enforce_microbiology_result_immutability()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.validation_status in ('validated','amended') and (
    new.result_status is distinct from old.result_status or
    new.organism is distinct from old.organism or
    new.organisms is distinct from old.organisms or
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
    new.interpretation_version is distinct from old.interpretation_version or
    new.cfu_count is distinct from old.cfu_count or
    new.cfu_limit is distinct from old.cfu_limit or
    new.within_limit is distinct from old.within_limit
  ) then
    raise exception 'Validated microbiology results are immutable; create an amendment instead.' using errcode='23514';
  end if;
  return new;
end;
$function$;
